import { Platform, App, Editor, MarkdownView, WorkspaceLeaf, editorViewField, Modal, TextComponent, ButtonComponent, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { EditorView, gutter, GutterMarker } from "@codemirror/view"
import { StateField, StateEffect, RangeSet } from "@codemirror/state"
import * as CodeMirror from 'codemirror';
import { around } from 'monkey-around';

interface Pos { line: number, ch: number }

interface VimExPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: VimExPluginSettings = {
	mySetting: 'default'
}

export default class VimExPlugin extends Plugin {
	settings: VimExPluginSettings;

  editor: Editor;

	async onload() {
		await this.loadSettings();

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'file-rename-modal',
			name: 'Rename file',
			callback: () => {
				new FileRenameModal(this.app).open();
			}
		});

    this.addCommand({
      id: 'notice',
      name: 'nitice',
      callback: () => {
        const notice = new InfoNotice("exmap :w disabled");

        if (Platform.isDesktop) {
          notice.noticeEl.oncontextmenu = () => {
            notice.hide();
          };
        }
      }
    })

    this.enableVimMarkGutter();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new VimExSettingTab(this.app, this));
	}

	onunload() {

	}

  async initialize() {
    console.log("initialize");
  }

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

  enableVimMarkGutter() {
    this.registerEditorExtension(breakpointGutter);

    this.app.workspace.on('active-leaf-change', async (leaf: WorkspaceLeaf) => {
      if (leaf.view.getViewType() == "markdown") {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        this.editor = (view as any).sourceMode?.cmEditor?.cm?.cm;
      }
    });

    let that = this;
    around((window as any).CodeMirrorAdapter.prototype, {
      setBookmark: (next) =>
        function (cursor: Pos) {
          // cursor.ch = 0;
          if (cursor) {
            const offset = this.indexFromPos(cursor);
            for (const key in this.state.vim.marks) {
              const mark = this.state.vim.marks[key];
              // TODO 找到 key 相同的 mark，取消 gutter
              // if (mark.offset == offset) {
              // }
            }
          }
          const marker = next && next.apply(this, [cursor]);
          // const view = that.app.workspace.getActiveViewOfType(MarkdownView);
          // console.log("marks in vim: ", this.state.vim.marks); // marks in vim.js
          // console.log("marks in cm_adapter", this.marks); // marks in cm_adapter.ts
          // const callStack = (new Error()).stack
          // if (callStack && /Object\.setMark/.test(callStack)) {
            // toggleBreakpoint(this.cm6, marker.offset);
          // }
          return marker;
        }
      });

    (window as any).CodeMirrorAdapter.Vim.defineAction("setMark", function(cm: any, actionArgs: any, vim: any) {
      var markName = actionArgs.selectedCharacter;
      updateMark(cm, vim, markName, cm.getCursor());
    });
  }
}

function inArray(val, arr) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] == val) {
      return true;
    }
  }
  return false;
}

function makeKeyRange(start, size) {
  var keys = [];
  for (var i = start; i < start + size; i++) {
    keys.push(String.fromCharCode(i));
  }
  return keys;
}
var upperCaseAlphabet = makeKeyRange(65, 26);
var lowerCaseAlphabet = makeKeyRange(97, 26);
var numbers = makeKeyRange(48, 10);
var validMarks = [].concat(upperCaseAlphabet, lowerCaseAlphabet, numbers, ['<', '>']);

function circledLatin(code: number) {
  if (code == 48) {
    return 0x24EA;
  } else if (code > 48 && code <= 58) {
    return code + 0x242F;
  } else if (code >= 65 && code <= 91) {
    return code + 0x2475;
  } else if (code >= 97 && code <= 123) {
    return code + 0x246F;
  }

  return code;
}

function updateMark(cm, vim, markName, pos) {
  if (!inArray(markName, validMarks)) {
    return;
  }

  var circledMarkName = String.fromCharCode(circledLatin(markName.charCodeAt()));
  var oldMark = vim.marks[markName];
  if (oldMark) {
    // console.log("remove: ", markName);
    disableBreakpoint(cm.cm6, oldMark.offset, circledMarkName);
    oldMark.clear();
  }
  var mark = cm.setBookmark(pos);
  vim.marks[markName] = mark

  // console.log("add: ", markName);
  enableBreakpoint(cm.cm6, mark.offset, circledMarkName);
}

const breakpointEffect = StateEffect.define<{pos: number, on: boolean, name: string}>({
  map: (val, mapping) => ({pos: mapping.mapPos(val.pos), on: val.on, name: val.name})
})

const breakpointState = StateField.define<RangeSet<GutterMarker>>({
  create() { return RangeSet.empty },
  update(set, transaction) {
    set = set.map(transaction.changes)
    for (let e of transaction.effects) {
      if (e.is(breakpointEffect)) {
        if (e.value.on)
          set = set.update({add: [new BreakpointGutter(e.value.name).range(e.value.pos)]})
        else
          set = set.update({filter: from => from != e.value.pos})
      }
    }
    return set
  }
})

function disableBreakpoint(view: EditorView, pos: number, name: string) {
  let breakpoints: any = view.state.field(breakpointState)
  let hasBreakpoint = true
  breakpoints.between(pos, pos, () => {hasBreakpoint = false})
  view.dispatch({
    effects: breakpointEffect.of({pos, on: false, name})
  })
}

function enableBreakpoint(view: EditorView, pos: number, name: string) {
  let breakpoints: any = view.state.field(breakpointState)
  let hasBreakpoint = false
  breakpoints.between(pos, pos, () => {hasBreakpoint = true})
  view.dispatch({
    effects: breakpointEffect.of({pos, on: true, name})
  })
}

function toggleBreakpoint(view: EditorView, pos: number) {
  let breakpoints: any = view.state.field(breakpointState)
  let hasBreakpoint = false
  breakpoints.between(pos, pos, () => {hasBreakpoint = true})
  view.dispatch({
    effects: breakpointEffect.of({pos, on: !hasBreakpoint, name: ""})
  })
}

class BreakpointGutter extends GutterMarker {
  name : string

  constructor(name: string) {
    super()
    this.name = name
  }

  toDOM() {
    return document.createTextNode(this.name)
  }
}

const breakpointGutter = [
  breakpointState,
  gutter({
    class: "cm-breakpoint-gutter",
    markers: view => view.state.field(breakpointState),
    initialSpacer: () => new BreakpointGutter("X")
  }),
  EditorView.baseTheme({
    ".cm-breakpoint-gutter .cm-gutterElement": {
      color: "red",
      paddingLeft: "5px",
      cursor: "default",
    }
  })
]

class FileRenameModal extends Modal {
  basename: string | undefined;

	constructor(app: App) {
		super(app);

    this.basename = app.workspace.getActiveViewOfType(MarkdownView)?.file.basename;

    this.modalEl.style.width = "20em";
	}

	onOpen() {
    let _this = this;
    const { titleEl, modalEl, contentEl } = this;

    titleEl.innerText = "Rename file";

    let inputTextComponent = new TextComponent(contentEl).setValue(this.basename || "Untitled").setPlaceholder("Untitled");

    const buttonEl = modalEl.createDiv();
    buttonEl.addClass("modal-button-container");
    let saveButton = new ButtonComponent(buttonEl)
      .setButtonText("Save")
      .onClick(() => {
        const file = app.workspace.getActiveViewOfType(MarkdownView)?.file;
        const basename = inputTextComponent.getValue();
        if (file && basename) {
          const path = file.parent.path;
          const ext = file.extension;
          _this.app.fileManager.renameFile(file, `${path}/${basename}.${ext}`);
        }
        this.close();
      }).buttonEl.addClass("mod-cta");
    let cancelButton = new ButtonComponent(buttonEl)
      .setButtonText("Cancel")
      .onClick(() => {
        this.close();
      });
    inputTextComponent.inputEl.size = 40;
    inputTextComponent.inputEl.focus();
    inputTextComponent.inputEl.setSelectionRange(inputTextComponent.getValue().length, inputTextComponent.getValue().length);
    inputTextComponent.inputEl.addEventListener('keypress', function (keypressed) {
      if (keypressed.key === 'Enter') {
        const file = app.workspace.getActiveViewOfType(MarkdownView)?.file;
        const basename = inputTextComponent.getValue();
        if (file && basename) {
          const path = file.parent.path;
          const ext = file.extension;
          _this.app.fileManager.renameFile(file, `${path}/${basename}.${ext}`);
        }
        _this.close();
      }
    });
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class InfoNotice extends Notice {
  constructor(
    message: string | DocumentFragment,
    timeout = 5
  ) {
    super(`Obsidian-VimEx\n${message}`, timeout * 1000);
    console.info(`Obsidian-VimEx: ${message}`);
  }
}

class VimExSettingTab extends PluginSettingTab {
	plugin: VimExPlugin;

	constructor(app: App, plugin: VimExPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings'});

		new Setting(containerEl)
			.setName('File Rename Modal')
			.setDesc('')
	}
}
