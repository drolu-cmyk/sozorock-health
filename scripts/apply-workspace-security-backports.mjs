import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha256 = value => createHash('sha256').update(value).digest('hex');

const targets = [
  {
    file: 'apps/mobile/node_modules/zod/v3/types.cjs',
    before: '06487cc05ed45c5dd29789bf0aa75734d1ce06592a7f2665ba4ca90a68e8a3e1',
    after: '7b103758da1d160395554258342b827fc14db2bbfda3f712c41ed344465b499c',
    replacements: [
      [
        '                status.dirty();\n            }\n        }\n        if (def.minLength !== null)',
        '                status.dirty();\n                if (tooBig)\n                    return (0, parseUtil_js_1.DIRTY)(ctx.data);\n            }\n        }\n        if (def.minLength !== null)',
      ],
      [
        '                    message: def.maxLength.message,\n                });\n                status.dirty();\n            }\n        }',
        '                    message: def.maxLength.message,\n                });\n                status.dirty();\n                return (0, parseUtil_js_1.DIRTY)(ctx.data);\n            }\n        }',
      ],
    ],
  },
  {
    file: 'apps/mobile/node_modules/zod/v3/types.js',
    before: '9763a2938f0e7f983363ef4bf6530e7583e3f2d54f8a4a6684efad58febc6e8e',
    after: 'a614a93def335978a321f2b82b017335796d947ff3a7f3ec0b24c8b8e22995e7',
    replacements: [
      [
        '                status.dirty();\n            }\n        }\n        if (def.minLength !== null)',
        '                status.dirty();\n                if (tooBig)\n                    return DIRTY(ctx.data);\n            }\n        }\n        if (def.minLength !== null)',
      ],
      [
        '                    message: def.maxLength.message,\n                });\n                status.dirty();\n            }\n        }',
        '                    message: def.maxLength.message,\n                });\n                status.dirty();\n                return DIRTY(ctx.data);\n            }\n        }',
      ],
    ],
  },
];

for (const target of targets) {
  const file = path.join(root, target.file);
  let source = await readFile(file, 'utf8');
  const current = sha256(source);
  if (current === target.after) continue;
  assert.equal(current, target.before, `${target.file}: unexpected upstream source`);
  for (const [from, to] of target.replacements) {
    assert.equal(source.split(from).length, 2, `${target.file}: security backport anchor changed`);
    source = source.replace(from, to);
  }
  assert.equal(sha256(source), target.after, `${target.file}: security backport result changed`);
  await writeFile(file, source, 'utf8');
}
