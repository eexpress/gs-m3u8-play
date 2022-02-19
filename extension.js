const { GObject, GLib, Gio, Clutter, St } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Me = ExtensionUtils.getCurrentExtension();
const ByteArray = imports.byteArray;

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

const debug = false;
//~ const debug = true;
function lg(s) {
	if (debug) log("===" + Me.metadata['gettext-domain'] + "===>" + s);
}

const Indicator = GObject.registerClass(
	class Indicator extends PanelMenu.Button {
		_init() {
			this.list = [];
			this.favorlist = []; // name,url

			const m3u8path = GLib.get_home_dir() + "/.local/share/m3u8-play/";
			this.favorfile = m3u8path + "favor.list";
			if (GLib.file_test(this.favorfile, GLib.FileTest.IS_REGULAR)) {
				this.get_favor(this.favorfile);
			} else {
				const favor_default = Me.path + "/favor.list.default";
				this.get_favor(favor_default);
				this.save_favor();
			}

			const tempfile = "/tmp/m3u8.all";
			let urllist = '';
			try {
				if (!GLib.file_test(tempfile, GLib.FileTest.IS_REGULAR)) {
					//~ GLib.spawn_command_line_sync(`cat ${m3u8path}*.m3u* > ${tempfile}`);
					const f = this.ls(m3u8path);
					let output = '';
					f.forEach((str) => {
						if (str.includes(".m3u")) {
							const [ok, content] = GLib.file_get_contents(m3u8path + str);
							if (ok) output += ByteArray.toString(content);
						}
					});
					GLib.file_set_contents(tempfile, output);
				}
				urllist = ByteArray.toString(GLib.file_get_contents(tempfile)[1]);
			} catch (e) { lg("Read URLs fail."); }

			if (!urllist) {
				Main.notify(_("居然没有播放列表。"));
			}

			const re = /#EXTINF:.+?,([^\n\r]+?)\r*\n((?:http|https|rtmp):\/\/.+?)\r*\n/sg;
			//存在 \r(0d)。文件最后一行没回车，导致匹配失败。失败的，都整体代入了？
			this.list = urllist.replace(re, "$1,$2\n").split('\n');
			//~ GLib.file_set_contents('/tmp/tempfile', this.list.join("\n"));

			super._init(0.0, _('M3U8 Play'));

			const stock_icon = new St.Icon({ icon_name : 'folder-videos-symbolic', icon_size : 30 });
			this.add_child(stock_icon);

			const item_input = new PopupMenu.PopupBaseMenuItem({
				reactive : false,
				can_focus : false
			});
			this.input = new St.Entry({
				name : 'searchEntry',
				primary_icon : new St.Icon({ icon_name : 'edit-clear-all-symbolic', icon_size : 24 }),
				secondary_icon : new St.Icon({ icon_name : 'folder-saved-search-symbolic', icon_size : 24 }),
				can_focus : true,
				hint_text : _('输入文字，搜索流媒体。'),
				x_expand : true,
			});
			this.input.connect('primary-icon-clicked', () => { this.input.text = ''; });
			this.input.connect('secondary-icon-clicked', () => { this.find_add_menu(); });
			this.input.clutter_text.connect('activate', () => { this.find_add_menu(); });
			item_input.add(this.input);
			this.menu.addMenuItem(item_input);
			this.add_favor();
		}

		add_favor() {
			this.favorlist.forEach((str, i, arr) => {
				if (str.includes(',')) {
					const [name, url] = str.split(',');
					this.add_menu(name, url, true);
				}
			});
		}

		find_add_menu() {
			const max = 24;
			let cnt = max - this.favorlist.length;
			let s = this.input.text;
			if (!s) return;
			this.menu._getMenuItems().forEach((j) => {if(!j.favor_flag && j.url) j.destroy(); });
			for (let i = 0; i < this.list.length; i++) {
				let str = this.list[i];
				if (!str || str.indexOf(',') < 0 || str.indexOf('#EXT') >= 0) continue;
				if (this.favorlist.indexOf(str) >= 0) continue;
				const [name, url] = str.split(',');
				if (!name.includes(s)) continue;
				this.add_menu(name, url, false);
				cnt--;
				if (cnt <= 0) {
					Main.notify(_("搜索列表最多显示 %d 个。爆了。").format(max));
					return;
				}
			}
		}

		add_menu(name, url, is_favor) {
			const icon_find0 = "view-app-grid-symbolic";
			const icon_find1 = "value-increase-symbolic";
			const icon_favor0 = "star-new-symbolic";
			const icon_favor1 = "value-decrease-symbolic";
			const item = new PopupMenu.PopupImageMenuItem("  " + name, is_favor ? icon_favor0 : icon_find0);
			item._icon.set_reactive(true);
			item.url = url;
			item.favor_flag = is_favor;
			item._icon.connect('enter-event', (actor) => {
				item.setIcon(item.favor_flag ? icon_favor1 : icon_find1);
			});
			item._icon.connect('leave-event', (actor) => {
				item.setIcon(item.favor_flag ? icon_favor0 : icon_find0);
			});
			item._icon.connect('button-release-event', (actor) => {
				if (item.favor_flag) {
					//~ delete this.favorlist[this.favorlist.indexOf(name+","+url)];
					this.favorlist.splice(this.favorlist.indexOf(name + "," + url), 1);
					this.save_favor();
					this.menu.moveMenuItem(item, this.menu._getMenuItems().length - 1);
					item.favor_flag = false;
					item.setIcon(icon_find0);
				} else {
					this.favorlist.push(name + "," + url);
					this.save_favor();
					this.menu.moveMenuItem(item, 1);
					item.favor_flag = true;
					item.setIcon(icon_favor0);
				}
				return Clutter.EVENT_STOP;
			});
			item.connect('activate', (actor) => {
				GLib.spawn_command_line_async('ffplay ' + actor.url);
			});
			this.menu.addMenuItem(item);
		}

		get_favor(str) {
			const [ok, content] = GLib.file_get_contents(str);
			if (ok) {
				const tl = ByteArray.toString(content).split('\n');
				for (let i of tl) {
					if (i && i.includes(',')) this.favorlist.push(i);
				}
			}
		};

		save_favor() {
			let out = '';
			this.favorlist.forEach((str) => {
				if (str.includes(',')) { out += str + '\n'; }
			});
			GLib.file_set_contents(this.favorfile, out);
		}

		ls(path) { // return an array of files in path
			const dir = Gio.File.new_for_path(path);
			let fileEnum;
			let r = [];
			try {
				fileEnum = dir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
			} catch (e) { fileEnum = null; }
			if (fileEnum != null) {
				let info;
				while (info = fileEnum.next_file(null))
					r.push(info.get_name());
			}
			return r;
		}
	});

class Extension {
	constructor(uuid) {
		this._uuid = uuid;
		ExtensionUtils.initTranslations();
	}

	enable() {
		this._indicator = new Indicator();
		Main.panel.addToStatusArea(this._uuid, this._indicator);
		lg("start");
	}

	disable() {
		this._indicator.destroy();
		this._indicator = null;
		lg("stop");
	}
}

function init(meta) {
	return new Extension(meta.uuid);
}
