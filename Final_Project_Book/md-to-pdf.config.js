module.exports = {
  stylesheet: ['project-book.css'],
  pdf_options: {
    format: 'A4',
    printBackground: true,
    margin: {
      top: '2.5cm',
      right: '2.5cm',
      bottom: '3cm',
      left: '2.5cm',
    },
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate:
      '<div style="width:100%;font-size:9pt;text-align:center;color:#333;font-family:Times New Roman,serif;"><span class="pageNumber"></span></div>',
  },
  body_class: 'project-book',
  marked_options: {
    gfm: true,
    breaks: false,
  },
};
