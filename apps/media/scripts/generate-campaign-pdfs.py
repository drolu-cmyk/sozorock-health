from __future__ import annotations

import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parents[1]
CAMPAIGN_PATH = ROOT / "gpt-live-campaign" / "campaign.json"
OUTPUT_DIR = ROOT / "output" / "pdf"

INK = colors.HexColor("#081d19")
PAPER = colors.HexColor("#fbf8ef")
MOSS = colors.HexColor("#789b62")
GOLD = colors.HexColor("#c58e24")
CLAY = colors.HexColor("#b9553e")
CYAN = colors.HexColor("#397e79")
RULE = colors.HexColor("#d7d7cf")


def register_fonts() -> tuple[str, str]:
    regular = Path("C:/Windows/Fonts/arial.ttf")
    bold = Path("C:/Windows/Fonts/arialbd.ttf")
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont("SozoSans", str(regular)))
        pdfmetrics.registerFont(TTFont("SozoSansBold", str(bold)))
        return "SozoSans", "SozoSansBold"
    return "Helvetica", "Helvetica-Bold"


FONT, FONT_BOLD = register_fonts()


def clean(value: str) -> str:
    return (
        value.replace("‑", "-")
        .replace("–", "-")
        .replace("—", "-")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def styles():
    base = getSampleStyleSheet()
    return {
        "eyebrow": ParagraphStyle(
            "Eyebrow",
            parent=base["Normal"],
            fontName=FONT_BOLD,
            fontSize=8.5,
            leading=11,
            textColor=MOSS,
            spaceAfter=10,
            uppercase=True,
        ),
        "title": ParagraphStyle(
            "Title",
            parent=base["Title"],
            fontName=FONT_BOLD,
            fontSize=25,
            leading=29,
            textColor=INK,
            alignment=TA_LEFT,
            spaceAfter=12,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=base["Normal"],
            fontName=FONT,
            fontSize=11,
            leading=16,
            textColor=INK,
            spaceAfter=14,
        ),
        "section": ParagraphStyle(
            "Section",
            parent=base["Heading2"],
            fontName=FONT_BOLD,
            fontSize=14,
            leading=18,
            textColor=INK,
            spaceBefore=8,
            spaceAfter=8,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName=FONT,
            fontSize=9.5,
            leading=14,
            textColor=INK,
            spaceAfter=7,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=base["BodyText"],
            fontName=FONT,
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor("#44534f"),
        ),
        "cell": ParagraphStyle(
            "Cell",
            parent=base["BodyText"],
            fontName=FONT,
            fontSize=8.25,
            leading=11.5,
            textColor=INK,
        ),
        "cell_bold": ParagraphStyle(
            "CellBold",
            parent=base["BodyText"],
            fontName=FONT_BOLD,
            fontSize=8.25,
            leading=11.5,
            textColor=INK,
        ),
        "cell_header": ParagraphStyle(
            "CellHeader",
            parent=base["BodyText"],
            fontName=FONT_BOLD,
            fontSize=8.25,
            leading=11.5,
            textColor=colors.white,
        ),
    }


S = styles()


def timestamp(milliseconds: int) -> str:
    total = milliseconds / 1000
    minutes = int(total // 60)
    seconds = total - minutes * 60
    return f"{minutes:02d}:{seconds:04.1f}"


def make_footer(locale: str):
    def footer(canvas, doc):
        campaign_label = (
            "SozoRock Health - Voice Access campaign"
            if locale == "en"
            else "SozoRock Health - Campaña de Acceso por Voz"
        )
        page_label = "Page" if locale == "en" else "Página"
        canvas.saveState()
        canvas.setStrokeColor(RULE)
        canvas.line(0.72 * inch, 0.55 * inch, 7.78 * inch, 0.55 * inch)
        canvas.setFont(FONT, 7.5)
        canvas.setFillColor(colors.HexColor("#52625d"))
        canvas.drawString(0.72 * inch, 0.36 * inch, campaign_label)
        canvas.drawRightString(7.78 * inch, 0.36 * inch, f"{page_label} {doc.page}")
        canvas.restoreState()

    return footer


def remove_footer_only_pages(path: Path):
    reader = PdfReader(str(path))
    writer = PdfWriter()
    for page in reader.pages:
        text = " ".join((page.extract_text() or "").split())
        remainder = text.replace("SozoRock Health - Voice Access campaign", "")
        remainder = remainder.replace("Page", "")
        remainder = "".join(character for character in remainder if not character.isdigit()).strip()
        if remainder:
            writer.add_page(page)
    temp_path = path.with_suffix(".clean.pdf")
    with temp_path.open("wb") as handle:
        writer.write(handle)
    temp_path.replace(path)


def cover(story, locale: str, persona: str, status: str):
    copy = {
        "en": {
            "title": "Voice Access campaign",
            "summary": "Approved English interaction script and production direction for an 80-second social campaign.",
            "resident": "Resident",
            "interaction": "Interaction",
            "interaction_value": "Natural turn-taking, self-correction, interruption, consent, request preview, and tap-or-text handoff",
            "boundary": "Boundary",
            "boundary_value": "Non-clinical. No diagnosis, treatment, prescribing, or clinical decision-making.",
            "status": "Status",
            "voice_heading": "Voice direction",
            "voice": "Warm, calm, clear, assured, conversational, and measured. The guide waits through thinking pauses, yields immediately when interrupted, acknowledges sparingly, confirms meaning before acting, and keeps tap or text alternatives available.",
            "accuracy_heading": "Accuracy note",
            "accuracy": "GPT-Live is the interaction reference. OpenAI states that GPT-Live powers ChatGPT Voice and that developer API access is planned. These materials must not be represented as GPT-Live output until an official API model is released and enabled for SozoRock Health.",
            "reference": "Official reference",
            "formats_heading": "Release formats",
            "formats": "X 1280 x 720; LinkedIn 1080 x 1350; Instagram Reels 1080 x 1920; YouTube Shorts 1080 x 1920. Every version includes open captions, a poster image, an 80-second visual narrative, and an ambient bed beneath the final dialogue.",
        },
        "es": {
            "title": "Campaña de Acceso por Voz",
            "summary": "Guion de interacción en español y dirección de producción aprobados para una campaña social de 80 segundos.",
            "resident": "Residente",
            "interaction": "Interacción",
            "interaction_value": "Turnos naturales, autocorrección, interrupción, consentimiento, vista previa y envío por toque o texto",
            "boundary": "Límite",
            "boundary_value": "No clínico. Sin diagnóstico, tratamiento, prescripción ni decisiones clínicas.",
            "status": "Estado",
            "voice_heading": "Dirección de voz",
            "voice": "Cálida, tranquila, clara, segura, conversacional y medida. La guía respeta las pausas, cede la palabra de inmediato cuando la interrumpen, reconoce con moderación, confirma el significado antes de actuar y mantiene disponibles las opciones de tocar o escribir.",
            "accuracy_heading": "Nota de precisión",
            "accuracy": "GPT-Live es la referencia de interacción. OpenAI indica que GPT-Live impulsa la Voz de ChatGPT y que el acceso para desarrolladores está previsto. Estos materiales no deben presentarse como producidos por GPT-Live hasta que exista un modelo oficial de API habilitado para SozoRock Health.",
            "reference": "Referencia oficial",
            "formats_heading": "Formatos de publicación",
            "formats": "X 1280 x 720; LinkedIn 1080 x 1350; Instagram Reels 1080 x 1920; YouTube Shorts 1080 x 1920. Cada versión incluye subtítulos abiertos, imagen de portada, narrativa visual de 80 segundos y música ambiental debajo del diálogo final.",
        },
    }[locale]
    story.extend(
        [
            Spacer(1, 0.4 * inch),
            Paragraph("SOZOROCK HEALTH", S["eyebrow"]),
            Paragraph(copy["title"], S["title"]),
            Paragraph(
                copy["summary"],
                S["subtitle"],
            ),
            Table(
                [
                    [Paragraph(copy["resident"], S["cell_bold"]), Paragraph(clean(persona), S["cell"])],
                    [Paragraph(copy["interaction"], S["cell_bold"]), Paragraph(copy["interaction_value"], S["cell"])],
                    [Paragraph(copy["boundary"], S["cell_bold"]), Paragraph(copy["boundary_value"], S["cell"])],
                    [Paragraph(copy["status"], S["cell_bold"]), Paragraph(clean(status), S["cell"])],
                ],
                colWidths=[1.15 * inch, 5.75 * inch],
                hAlign="LEFT",
                style=TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), PAPER),
                        ("BOX", (0, 0), (-1, -1), 0.7, RULE),
                        ("INNERGRID", (0, 0), (-1, -1), 0.4, RULE),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 9),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                        ("TOPPADDING", (0, 0), (-1, -1), 8),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ]
                ),
            ),
            Spacer(1, 0.25 * inch),
            Paragraph(copy["voice_heading"], S["section"]),
            Paragraph(
                copy["voice"],
                S["body"],
            ),
            Paragraph(copy["accuracy_heading"], S["section"]),
            Paragraph(
                copy["accuracy"],
                S["body"],
            ),
            Paragraph(f"{copy['reference']}: https://openai.com/index/introducing-gpt-live/", S["small"]),
            Spacer(1, 0.15 * inch),
            Paragraph(copy["formats_heading"], S["section"]),
            Paragraph(copy["formats"], S["body"]),
            PageBreak(),
        ]
    )


def script_table(lines: list[dict], locale: str):
    headings = (
        ("Time", "Speaker", "Dialogue")
        if locale == "en"
        else ("Tiempo", "Voz", "Diálogo")
    )
    rows = [
        [
            Paragraph(headings[0], S["cell_header"]),
            Paragraph(headings[1], S["cell_header"]),
            Paragraph(headings[2], S["cell_header"]),
        ]
    ]
    for line in lines:
        speaker = (
            "Renata"
            if line["speaker"] == "resident"
            else ("Voice Access" if locale == "en" else "Acceso por Voz")
        )
        rows.append(
            [
                Paragraph(timestamp(line["startMs"]), S["cell"]),
                Paragraph(speaker, S["cell_bold"]),
                Paragraph(clean(line["text"]), S["cell"]),
            ]
        )
    return Table(
        rows,
        colWidths=[0.65 * inch, 1.25 * inch, 5.0 * inch],
        repeatRows=1,
        hAlign="LEFT",
        style=TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), INK),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PAPER]),
                ("GRID", (0, 0), (-1, -1), 0.4, RULE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        ),
    )


def storyboard(story, locale: str):
    title = "Production sequence" if locale == "en" else "Secuencia de producción"
    labels = (
        [
            ("Listen", "Renata names the uncertainty; Voice Access leaves room for a pause."),
            ("Clarify", "Renata corrects herself; the guide reflects the request without clinical advice."),
            ("Ask permission", "County and language are used only after a clear yes."),
            ("Preview request", "Non-clinical request details become visible without saving or provider-match claims."),
            ("Yield", "Renata interrupts; the guide stops and confirms that no provider has been matched."),
            ("Confirm outside voice", "The resident reviews the details and chooses whether to submit by tap or text."),
        ]
        if locale == "en"
        else [
            ("Escuchar", "Renata expresa su duda; Acceso por Voz deja espacio para la pausa."),
            ("Aclarar", "Renata se corrige; la guía refleja la solicitud sin ofrecer orientación clínica."),
            ("Pedir permiso", "El condado y el idioma se usan solo después de un sí claro."),
            ("Revisar solicitud", "Se muestran datos no clínicos sin afirmar que se guardaron ni que existe una asignación de proveedor."),
            ("Ceder la palabra", "Renata interrumpe; la guía se detiene y confirma que no se ha asignado un proveedor."),
            ("Confirmar envío", "La persona revisa los datos y elige si envía por toque o texto."),
        ]
    )
    story.append(Paragraph(title, S["section"]))
    for index, (heading, detail) in enumerate(labels):
        accent = [CLAY, CYAN, GOLD, MOSS, CLAY, CYAN][index]
        story.append(
            KeepTogether(
                Table(
                    [[Paragraph(f"{index + 1}", S["cell_bold"]), Paragraph(clean(heading), S["cell_bold"]), Paragraph(clean(detail), S["cell"])]],
                    colWidths=[0.38 * inch, 1.32 * inch, 5.2 * inch],
                    style=TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (0, 0), accent),
                            ("TEXTCOLOR", (0, 0), (0, 0), colors.white),
                            ("BOX", (0, 0), (-1, -1), 0.5, RULE),
                            ("VALIGN", (0, 0), (-1, -1), "TOP"),
                            ("LEFTPADDING", (0, 0), (-1, -1), 8),
                            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                            ("TOPPADDING", (0, 0), (-1, -1), 7),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                        ]
                    ),
                )
            )
        )
        if index < len(labels) - 1:
            story.append(Spacer(1, 5))


def build(locale: str, file_name: str):
    campaign = json.loads(CAMPAIGN_PATH.read_text(encoding="utf-8"))
    content = campaign["locales"][locale]
    language = "English" if locale == "en" else "Spanish"
    status = (
        "Illustrative resident journey approved for production. Final OpenAI voice master pending active project billing. Visual previews are clearly labelled and show review only; voice does not save or submit a request, match a provider, or open a hub."
        if locale == "en"
        else "Recorrido ilustrativo aprobado para producción. La voz final de OpenAI está pendiente de la facturación. Las vistas muestran solo una revisión; la voz no guarda ni envía, asigna un proveedor ni abre un centro."
    )
    story = []
    cover(story, locale, content["persona"], status)
    script_heading = "English interaction script" if locale == "en" else "Guion de interacción en español"
    story.append(Paragraph(script_heading, S["section"]))
    story.append(script_table(content["lines"], locale))
    story.append(Spacer(1, 0.2 * inch))
    storyboard(story, locale)
    output_path = OUTPUT_DIR / file_name
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=letter,
        rightMargin=0.72 * inch,
        leftMargin=0.72 * inch,
        topMargin=0.65 * inch,
        bottomMargin=0.72 * inch,
        title=f"SozoRock Health Voice Access - {language}",
        author="The SozoRock Foundation Inc.",
        subject="Approved bilingual Voice Access campaign script and production direction",
    )
    footer = make_footer(locale)
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    remove_footer_only_pages(output_path)


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    build("en", "sozorock-health-voice-access-production-script-english.pdf")
    build("es", "sozorock-health-voice-access-production-script-spanish.pdf")
    print(OUTPUT_DIR)


if __name__ == "__main__":
    main()
