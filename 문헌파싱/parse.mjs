import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile, readdir, mkdir, writeFile, rm } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { parse } from 'kordoc';

const here = dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);
process.env.KORDOC_MODEL_CACHE ??= join(here, '.kordoc-models');
const packageJson = JSON.parse(await readFile(join(here, 'node_modules/kordoc/package.json'), 'utf8'));
const args = process.argv.slice(2);
const ocr = args.includes('--ocr');
const paths = args.filter(arg => arg !== '--ocr');
if (paths.length !== 1) {
  console.error('사용법: node 문헌파싱/parse.mjs <PDF 파일 또는 원문 폴더> [--ocr]');
  process.exit(2);
}

const source = resolve(paths[0]);
const sourceStat = await import('node:fs/promises').then(fs => fs.stat(source));
if (!sourceStat.isDirectory() && extname(source).toLowerCase() !== '.pdf') {
  console.error('PDF 파일 또는 PDF가 들어 있는 폴더만 입력할 수 있습니다.');
  process.exit(2);
}
const sourceDir = sourceStat.isDirectory() ? source : dirname(source);
const researchName = basename(sourceDir).toLowerCase() === '원문' ? basename(dirname(sourceDir)) : basename(sourceDir);
const outputDir = join(here, researchName);
await mkdir(outputDir, { recursive: true });
const files = sourceStat.isDirectory()
  ? (await readdir(sourceDir)).filter(name => extname(name).toLowerCase() === '.pdf').sort().map(name => join(sourceDir, name))
  : [source];
if (files.length === 0) {
  console.error('입력 폴더에 PDF가 없습니다.');
  process.exit(2);
}

const records = [];
for (const file of files) {
  const name = basename(file, extname(file));
  const id = /^L\d{2,}/i.exec(name)?.[0].toUpperCase() ?? 'ID미확인';
  const absolute = isAbsolute(file) ? file : resolve(file);
  const mdPath = join(outputDir, `${name}.md`);
  const jsonPath = join(outputDir, `${name}.json`);
  const imageDirName = `${name}_images`;
  const imageDir = join(outputDir, imageDirName);
  const record = {
    id,
    source: absolute,
    sha256: '',
    parser: `kordoc ${packageJson.version}`,
    processedAt: new Date().toISOString(),
    ocr,
    ocrProvider: ocr ? (process.platform === 'win32' && process.env.KORDOC_OCR_PROVIDER !== 'cpu' ? 'DirectML' : 'CPU') : '사용 안 함',
    status: '파싱 실패',
    markdown: null,
    json: null,
    images: [],
    sourcePages: null,
    parsedPages: 0,
    warnings: []
  };
  try {
    const pdf = await readFile(absolute);
    record.sha256 = createHash('sha256').update(pdf).digest('hex');
    try {
      const { stdout } = await execFileAsync('pdfinfo', [absolute]);
      const count = /^Pages:\s+(\d+)/m.exec(stdout);
      if (count) record.sourcePages = Number(count[1]);
      else record.warnings.push('pdfinfo에서 원본 쪽수를 확인하지 못함');
    } catch {
      record.warnings.push('pdfinfo 실행 실패: 원본 쪽수 수동 확인 필요');
    }
    const result = await parse(pdf, { ocr, scriptTags: true });
    if (!result.success) throw new Error(`${result.code ?? 'PARSE_ERROR'}: ${result.error ?? '알 수 없는 오류'}`);
    const imageNames = new Set();
    const imageFiles = Array.isArray(result.images) ? result.images : [];
    if (imageFiles.length) await mkdir(imageDir, { recursive: true });
    for (const item of imageFiles) {
      const safeName = basename(item.filename ?? '');
      if (!safeName || safeName !== item.filename || imageNames.has(safeName)) {
        record.warnings.push(`이미지 이름이 중복되거나 안전하지 않음: ${item.filename ?? '(없음)'}`);
        continue;
      }
      imageNames.add(safeName);
      await writeFile(join(imageDir, safeName), Buffer.from(item.data));
      record.images.push(join(imageDir, safeName));
    }
    const linkImages = markdown => (markdown ?? '').replace(/(!\[[^\]]*\]\()([^()]+)(\))/g, (full, start, target, end) =>
      imageNames.has(target) ? `${start}${imageDirName}/${target}${end}` : full);
    const pages = Array.isArray(result.pages) ? result.pages.map(page => ({
      ...page,
      markdown: linkImages(page.markdown)
    })) : [];
    if (record.sourcePages !== null && pages.length !== record.sourcePages)
      record.warnings.push(`쪽수 불일치: 원본 ${record.sourcePages}, 파싱 ${pages.length}`);
    if (pages.length === 0) record.warnings.push('쪽별 결과가 비어 있음');
    if (!(result.markdown ?? '').trim()) record.warnings.push('문서 전체 Markdown이 비어 있음');
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (page.pageNumber !== i + 1) record.warnings.push(`쪽 번호 불연속: 인덱스 ${i + 1}, 보고값 ${page.pageNumber}`);
      const content = page.markdown ?? '';
      if (!content.trim()) record.warnings.push(`PDF ${page.pageNumber ?? i + 1}쪽 출력이 비어 있음`);
      if (content.includes('\uFFFD') || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(content))
        record.warnings.push(`PDF ${page.pageNumber ?? i + 1}쪽에 깨진/제어 문자가 있음`);
      if (content.trim().length > 0 && content.trim().length < 500)
        record.warnings.push(`PDF ${page.pageNumber ?? i + 1}쪽 출력이 500자 미만: 수동 확인 필요`);
    }
    const structured = {
      source: absolute,
      sha256: record.sha256,
      parser: record.parser,
      metadata: result.metadata ?? null,
      pages,
      blocks: result.blocks ?? [],
      images: record.images
    };
    await writeFile(mdPath, linkImages(result.markdown), 'utf8');
    await writeFile(jsonPath, JSON.stringify(structured, null, 2), 'utf8');
    record.status = record.warnings.length ? '파싱 완료·검수 필요' : '파싱 완료·검수 전';
    record.markdown = mdPath;
    record.json = jsonPath;
    record.parsedPages = pages.length;
  } catch (error) {
    await Promise.all([rm(mdPath, { force: true }), rm(jsonPath, { force: true })]);
    record.warnings.push(String(error?.message ?? error));
  }
  records.push(record);
  console.log(`${record.id}: ${record.status} (${record.parsedPages}쪽)`);
}

await writeFile(join(outputDir, '처리현황.json'), JSON.stringify({
  source,
  outputDir,
  parser: `kordoc ${packageJson.version}`,
  processedAt: new Date().toISOString(),
  records
}, null, 2), 'utf8');
process.exit(records.some(record => record.status === '파싱 실패') ? 1 : 0);
