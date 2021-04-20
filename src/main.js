const fs = require('fs');
const path = require('path');
const glob = require('glob');
const chalk = require('chalk');

const BOUNDARY = 30;

function getGitIgnoreLines(dir) {
  let ignoreLines;

  try {
    ignoreLines = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  } catch (err) {
    console.log(err);
    return [];
  }

  const patterns = [];

  ignoreLines
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => Boolean(line) && !line.startsWith('#'))
    .forEach((line) => {
      let updated = line;

      if (updated.endsWith('/')) {
        updated += '**';
      } else {
        updated += '/**';
      }

      if (updated.startsWith('/')) {
        patterns.push(updated.substr(1, updated.length - 1));
      } else {
        patterns.push(updated, `**/${updated}`);
      }
    });

  return patterns;
}

function run({pattern, dir, colorize, showFileNames, showContent, gitIgnore, ignore, ignoreExts, errorCodeOnFound}) {
  let errorLines = 0;

  glob(
    pattern || '**',
    {
      cwd: dir,
      ignore: [
        'node_modules/**',
        '**/node_modules/**',
        '*cache*/**',
        '**/*cache*/**',
        ...ignoreExts.map((ext) => `**/*.${ext}`),
        ...(gitIgnore ? getGitIgnoreLines(dir) : []),
        ...(ignore || []),
      ],
      nodir: true,
    },
    (err, files) => {
      if (err) {
        console.error(err);
        process.exit(1);
        return;
      }

      if (files.length > 5000) {
        console.error(`Too many files found: ${files.length}`);
        process.exit(1);
        return;
      }

      outer: for (const filePath of files) {
        const buffer = fs.readFileSync(path.join(dir, filePath));

        for (let i = 0; i < buffer.length; i++) {
          if (buffer[i] === 0) {
            continue outer;
          }
        }

        const content = buffer.toString();

        const match = content.match(/[а-яёй]+/i);

        if (match) {
          console.log(`File "${filePath}" contains cyrillic chars${!showFileNames && !showContent ? '' : ':'}`);

          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineMatch = line.match(/[а-яёй]+(?:[\s,.:?+-]*[а-яёй]+)*/i);

            if (lineMatch) {
              errorLines++;

              let value = lineMatch[0];

              if (colorize) {
                value = chalk.bgRed(value);
              }

              let output = '  ';

              if (showFileNames) {
                output += `- ${filePath}:${i + 1}:${lineMatch.index + 1}`;
              }

              if (showContent) {
                const start = Math.max(0, lineMatch.index - BOUNDARY);
                const len = Math.min(BOUNDARY, lineMatch.index);
                const start2 = lineMatch.index + lineMatch[0].length;

                const str = `${lineMatch.index > BOUNDARY ? '... ' : ''}${line.substr(start, len)}${value}${line.substr(
                  start2,
                  BOUNDARY,
                )}${start2 + BOUNDARY < line.length ? ' ...' : ''}`;

                output += `  ${str}`;
              }

              if (output.trim()) {
                console.log(output);
              }

              if (errorLines > 100) {
                break;
              }
            }
          }
        }

        if (errorLines > 100) {
          break;
        }
      }

      if (errorLines > 0 && errorCodeOnFound) {
        process.exit(1);
      }
    },
  );
}

module.exports = run;
