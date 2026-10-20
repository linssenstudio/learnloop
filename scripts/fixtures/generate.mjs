// 生成 Wave 2 测试夹具：sample.pdf / sample.docx / sample.pptx（含中文真实文本）
// 用法：node scripts/fixtures/generate.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)));

const PDF_PAGES = [
  "机器学习基础。机器学习是人工智能的重要分支，它让计算机能够从数据中自动学习规律，而无需显式编程。常见的学习方式包括监督学习、无监督学习和强化学习。监督学习使用带标签的数据训练模型，例如分类与回归任务。",
  "神经网络入门。神经网络由大量神经元相互连接而成，每个神经元对输入进行加权求和并经过激活函数输出。反向传播算法通过链式法则计算梯度，配合梯度下降不断更新权重，使损失函数逐步降低。深度学习在图像识别与自然语言处理领域取得了巨大成功。",
  "过拟合与正则化。当模型在训练集上表现很好但在测试集上表现很差时，称为过拟合。常见的缓解方法包括增加训练数据、使用 L1 或 L2 正则化、Dropout 以及早停策略。交叉验证可以帮助我们更可靠地评估模型的泛化能力。",
];

const DOCX_SECTIONS = [
  { heading: "第一章 数据结构概述", body: "数据结构是计算机存储、组织数据的方式。合理选择数据结构可以显著提升程序的运行效率。常见的线性结构包括数组、链表、栈和队列。" },
  { heading: "第二章 树与图", body: "树是一种层次结构，二叉树是最常见的树形结构。图由顶点和边组成，可以表示复杂的网络关系，例如社交网络与路径规划。" },
  { heading: "第三章 排序算法", body: "快速排序的平均时间复杂度为 O(n log n)，它采用分治思想，通过基准元素将数组划分为两部分递归排序。归并排序稳定且同样高效。" },
];

const PPTX_SLIDES = [
  { title: "光合作用", body: "光合作用是植物利用光能将二氧化碳和水转化为有机物并释放氧气的过程。" },
  { title: "光反应阶段", body: "光反应发生在类囊体膜上，产生 ATP 和 NADPH，同时分解水分子释放氧气。" },
  { title: "暗反应阶段", body: "暗反应在叶绿体基质中进行，通过卡尔文循环固定二氧化碳，最终合成葡萄糖。" },
];

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function genPdf() {
  const { default: PDFDocument } = await import("pdfkit");
  const fontCandidates = [
    ["/System/Library/Fonts/PingFang.ttc", "PingFangSC-Regular"],
    ["/System/Library/Fonts/STHeiti Light.ttc", "STHeitiSC-Light"],
    ["/System/Library/Fonts/Hiragino Sans GB.ttc", "HiraginoSansGB-W3"],
  ];
  const doc = new PDFDocument({ margin: 60 });
  const stream = fs.createWriteStream(path.join(outDir, "sample.pdf"));
  doc.pipe(stream);
  let fontSet = false;
  for (const [p, family] of fontCandidates) {
    if (fs.existsSync(p)) {
      doc.font(p, family);
      fontSet = true;
      break;
    }
  }
  if (!fontSet) throw new Error("未找到可用的中文字体");
  PDF_PAGES.forEach((text, i) => {
    if (i > 0) doc.addPage();
    doc.fontSize(12).text(text, { lineGap: 6 });
  });
  doc.end();
  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

async function genDocx() {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const body = DOCX_SECTIONS.map(
    (s) =>
      `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">${esc(s.heading)}</w:t></w:r></w:p>` +
      `<w:p><w:r><w:t xml:space="preserve">${esc(s.body)}</w:t></w:r></w:p>`
  ).join("");
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
  );
  fs.writeFileSync(path.join(outDir, "sample.docx"), await zip.generateAsync({ type: "nodebuffer" }));
}

async function genPptx() {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const slideOverrides = PPTX_SLIDES.map(
    (_, i) =>
      `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
  ).join("");
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>${slideOverrides}</Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`
  );
  const sldIds = PPTX_SLIDES.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join("");
  zip.file(
    "ppt/presentation.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst>${sldIds}</p:sldIdLst></p:presentation>`
  );
  const slideRels = PPTX_SLIDES.map(
    (_, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`
  ).join("");
  zip.file(
    "ppt/_rels/presentation.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${slideRels}</Relationships>`
  );
  PPTX_SLIDES.forEach((s, i) => {
    zip.file(
      `ppt/slides/slide${i + 1}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${esc(s.title)}</a:t></a:r></a:p><a:p><a:r><a:t>${esc(s.body)}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`
    );
  });
  fs.writeFileSync(path.join(outDir, "sample.pptx"), await zip.generateAsync({ type: "nodebuffer" }));
}

await genPdf();
await genDocx();
await genPptx();
for (const f of ["sample.pdf", "sample.docx", "sample.pptx"]) {
  const st = fs.statSync(path.join(outDir, f));
  console.log(`${f}  ${st.size} bytes`);
}
