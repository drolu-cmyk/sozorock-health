import { Pool, type PoolClient, type PoolConfig } from "pg";
import { SOURCE_CATALOG } from "../source-catalog.ts";
import type { AdapterBatch, IngestionRepository, StoredImport } from "./types.ts";

function importStatus(status: StoredImport["status"]) {
  return status === "unavailable" ? "unavailable" : status;
}

async function ensureSourceCatalog(client: PoolClient, sourceId: string) {
  const source = SOURCE_CATALOG.find((candidate) => candidate.id === sourceId);
  if (!source) throw new Error(`Unknown source catalog record: ${sourceId}`);
  await client.query(
    `INSERT INTO evidence.source_catalog (
      id, family, publisher, title, official_url, host_policy, allowed_hosts,
      refresh_cadence, geography_kinds, review_status, limitations
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::evidence.geography_kind[],$10,$11::jsonb)
    ON CONFLICT (id) DO NOTHING`,
    [
      source.id, source.family, source.publisher, source.title, source.officialUrl,
      source.hostPolicy, source.allowedHosts, source.refreshCadence,
      source.geographyKinds, source.reviewStatus, JSON.stringify(source.limitations),
    ],
  );
}

export class PostgresIngestionRepository implements IngestionRepository {
  readonly pool: Pool;

  constructor(config: PoolConfig | Pool) {
    this.pool = config instanceof Pool ? config : new Pool(config);
  }

  static fromEnvironment() {
    const connectionString = process.env.EVIDENCE_DATABASE_URL;
    if (!connectionString) {
      throw new Error("EVIDENCE_DATABASE_URL is required and must be injected from the approved secret manager.");
    }
    return new PostgresIngestionRepository({
      connectionString,
      ssl: process.env.EVIDENCE_DATABASE_SSL === "disable" ? false : { rejectUnauthorized: true },
      max: Number(process.env.EVIDENCE_DATABASE_POOL_SIZE ?? "4"),
      application_name: "sozorock-evidence-ingestion",
    });
  }

  async close() {
    await this.pool.end();
  }

  async findImport(idempotencyKey: string): Promise<StoredImport | null> {
    const result = await this.pool.query(
      `SELECT state.*, version.id AS version_id, version.release_label, version.release_date,
        version.data_period_start, version.data_period_end, version.retrieved_at,
        version.stale_after, version.official_url, version.content_hash, version.schema_version,
        version.review_status, version.reviewed_by, version.reviewed_at
       FROM evidence.source_import_state state
       LEFT JOIN evidence.source_version version ON version.id = state.source_version_id
       WHERE state.idempotency_key = $1`,
      [idempotencyKey],
    );
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    const observations = row.source_version_id
      ? await this.pool.query(
        `SELECT observation.*, definition.source_measure_id, definition.name, definition.description,
          definition.direction, definition.higher_value_meaning, definition.unit, definition.universe,
          definition.adjustment, definition.comparison_policy, definition.review_status AS definition_review_status
         FROM evidence.metric_observation observation
         JOIN evidence.measure_definition definition ON definition.id = observation.measure_definition_id
         WHERE observation.source_version_id = $1`,
        [row.source_version_id],
      )
      : { rows: [] };
    const measureMap = new Map();
    const mappedObservations = observations.rows.map((observation) => {
      measureMap.set(observation.measure_definition_id, {
        id: observation.measure_definition_id,
        sourceMeasureId: observation.source_measure_id,
        name: observation.name,
        description: observation.description,
        direction: observation.direction,
        higherValueMeaning: observation.higher_value_meaning,
        unit: observation.unit,
        universe: observation.universe,
        adjustment: observation.adjustment,
        comparisonPolicy: observation.comparison_policy,
        reviewStatus: observation.definition_review_status,
      });
      return {
        id: observation.id,
        measureDefinitionId: observation.measure_definition_id,
        geographyId: observation.geography_id,
        sourceVersionId: observation.source_version_id,
        sourceRecordId: observation.source_record_id,
        sourceUrl: observation.source_url,
        geographyLevel: observation.geography_level,
        value: observation.value_json ?? observation.numeric_value,
        numericValue: observation.numeric_value === null ? null : Number(observation.numeric_value),
        confidenceLow: observation.confidence_low === null ? null : Number(observation.confidence_low),
        confidenceHigh: observation.confidence_high === null ? null : Number(observation.confidence_high),
        marginOfError: observation.margin_of_error === null ? null : Number(observation.margin_of_error),
        releaseDate: String(observation.release_date),
        dataPeriodStart: observation.data_period_start ? String(observation.data_period_start) : null,
        dataPeriodEnd: observation.data_period_end ? String(observation.data_period_end) : null,
        retrievedAt: observation.retrieved_at.toISOString(),
        reviewStatus: observation.review_status,
        suppressionReason: observation.suppression_reason,
        sourceMetadata: observation.source_metadata,
      };
    });
    return {
      id: row.id,
      idempotencyKey: row.idempotency_key,
      adapterId: row.adapter_id,
      sourceId: row.source_id,
      status: row.status === "failed" ? "failed" : row.status,
      attemptedAt: row.attempted_at.toISOString(),
      successfulImportAt: row.successful_import_at?.toISOString() ?? null,
      failedAt: row.failed_at?.toISOString() ?? null,
      failureCode: row.failure_code,
      failureMessage: row.failure_message,
      sourceVersion: row.version_id ? {
        id: row.version_id,
        sourceId: row.source_id,
        releaseLabel: row.release_label,
        releaseDate: String(row.release_date),
        dataPeriodStart: row.data_period_start ? String(row.data_period_start) : null,
        dataPeriodEnd: row.data_period_end ? String(row.data_period_end) : null,
        retrievedAt: row.retrieved_at.toISOString(),
        staleAfter: row.stale_after.toISOString(),
        officialUrl: row.official_url,
        contentHash: row.content_hash,
        schemaVersion: row.schema_version,
        reviewStatus: row.review_status,
        reviewedBy: row.reviewed_by,
        reviewedAt: row.reviewed_at?.toISOString() ?? null,
      } : null,
      measures: [...measureMap.values()],
      observations: mappedObservations,
      recordsRead: row.records_read,
      recordsAccepted: row.records_accepted,
      recordsRejected: row.records_rejected,
      observationsPublished: row.observations_published,
      cacheDisposition: row.cache_disposition,
    } as StoredImport;
  }

  async beginImport(record: StoredImport) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await ensureSourceCatalog(client, record.sourceId);
      await client.query(
        `INSERT INTO evidence.source_import_state (
          id, adapter_id, source_id, idempotency_key, status, attempted_at
        ) VALUES ($1,$2,$3,$4,'running',$5)
        ON CONFLICT (idempotency_key) DO NOTHING`,
        [record.id, record.adapterId, record.sourceId, record.idempotencyKey, record.attemptedAt],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async publishBatch(record: StoredImport, batch: AdapterBatch) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await ensureSourceCatalog(client, record.sourceId);
      if (batch.sourceVersion) {
        const source = batch.sourceVersion;
        await client.query(
          `INSERT INTO evidence.source_version (
            id, source_id, release_label, release_date, data_period_start, data_period_end,
            retrieved_at, stale_after, official_url, content_hash, schema_version, review_status,
            reviewed_by, reviewed_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
          ON CONFLICT (source_id, release_label, content_hash) DO NOTHING`,
          [
            source.id, source.sourceId, source.releaseLabel, source.releaseDate,
            source.dataPeriodStart, source.dataPeriodEnd, source.retrievedAt, source.staleAfter,
            source.officialUrl, source.contentHash, source.schemaVersion, source.reviewStatus,
            source.reviewedBy, source.reviewedAt,
          ],
        );
        for (const measure of batch.measures) {
          await client.query(
            `INSERT INTO evidence.measure_definition (
              id, source_id, source_measure_id, name, description, direction, higher_value_meaning,
              unit, universe, adjustment, comparison_policy, review_status
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            ON CONFLICT (source_id, source_measure_id) DO NOTHING`,
            [
              measure.id, record.sourceId, measure.sourceMeasureId, measure.name, measure.description,
              measure.direction, measure.higherValueMeaning, measure.unit, measure.universe,
              measure.adjustment, measure.comparisonPolicy, measure.reviewStatus,
            ],
          );
        }
        for (const observation of batch.observations) {
          await client.query(
            `INSERT INTO evidence.metric_observation (
              id, measure_definition_id, geography_id, source_version_id, value_json, numeric_value,
              confidence_low, confidence_high, margin_of_error, release_date, data_period_start,
              data_period_end, retrieved_at, review_status, suppression_reason, source_record_id,
              source_url, geography_level, source_metadata
            ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb)
            ON CONFLICT (source_version_id, source_record_id, measure_definition_id, geography_id) DO NOTHING`,
            [
              observation.id, observation.measureDefinitionId, observation.geographyId,
              observation.sourceVersionId, observation.value === null ? null : JSON.stringify(observation.value),
              observation.numericValue, observation.confidenceLow, observation.confidenceHigh,
              observation.marginOfError, observation.releaseDate, observation.dataPeriodStart,
              observation.dataPeriodEnd, observation.retrievedAt, observation.reviewStatus,
              observation.suppressionReason, observation.sourceRecordId, observation.sourceUrl,
              observation.geographyLevel, JSON.stringify(observation.sourceMetadata),
            ],
          );
        }
      }
      await client.query(
        `UPDATE evidence.source_import_state SET
          source_version_id=$2, status=$3, successful_import_at=$4, source_release_label=$5,
          source_release_date=$6, source_data_period_start=$7, source_data_period_end=$8,
          records_read=$9, records_accepted=$10, records_rejected=$11,
          observations_published=$12, cache_disposition=$13, failure_message=$14, updated_at=now()
         WHERE idempotency_key=$1`,
        [
          record.idempotencyKey, batch.sourceVersion?.id ?? null, importStatus(batch.status),
          batch.status === "available" || batch.status === "stale" ? record.successfulImportAt : null,
          batch.sourceVersion?.releaseLabel ?? null, batch.sourceVersion?.releaseDate ?? null,
          batch.sourceVersion?.dataPeriodStart ?? null, batch.sourceVersion?.dataPeriodEnd ?? null,
          batch.recordsRead, batch.recordsAccepted, batch.recordsRejected, batch.observations.length,
          batch.cacheDisposition, batch.statusReason,
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async failImport(idempotencyKey: string, failedAt: string, code: string, message: string) {
    await this.pool.query(
      `UPDATE evidence.source_import_state SET
        status='failed', failed_at=$2, failure_code=$3, failure_message=$4, updated_at=now()
       WHERE idempotency_key=$1`,
      [idempotencyKey, failedAt, code, message],
    );
  }
}
