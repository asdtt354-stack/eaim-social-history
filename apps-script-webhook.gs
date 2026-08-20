/* 구글시트 확장프로그램 > Apps Script 에 붙여넣고
   "배포 > 웹앱으로 배포" (액세스 권한: 모든 사용자) 후 나오는 URL을
   교사 허브의 "구글시트 Apps Script 웹훅 URL"에 넣으세요. */

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = JSON.parse(e.postData.contents);
  sheet.appendRow([data.date, data.content]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
