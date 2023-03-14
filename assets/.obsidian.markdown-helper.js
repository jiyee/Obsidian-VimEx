// https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts
// parameters: editor, view, selection
function jumpHeading(isForward) {
	let cursor = editor.getCursor();
  let line = cursor.line;

  do {
    line += isForward ? 1 : -1;
    if (line < 0 && !isForward) {
      line = editor.lineCount();
    }
    if (line >= editor.lineCount() && isForward) {
      line = 0;
    }

    let lineString = editor.getLine(line);
    if (/^#(#*) /.test(lineString)) {
      cursor.line = line;
      editor.setCursor(cursor);
      break;
    }
  } while (line != cursor.line)
}

function scrollToCursor(percent) {
  var lineNum = editor.getCursor().line;
  var pos = new Pos(lineNum, 0, null);
  var charCoords = editor.coordsAtPos(pos, true);
  var height = editor.getScrollInfo().clientHeight;
  var y = charCoords.bottom - height * (1 - percent);
  editor.scrollTo(null, y);
}

function scrollToTop() {
  editor.scrollTo(null, 0);
  var app = editor.cm.cm;
  debugger;
}