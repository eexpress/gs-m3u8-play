const GETTEXT_DOMAIN = 'm3u8-play';	//这行说指向翻译的 mo 文件名的关键
const _ = imports.gettext.domain(GETTEXT_DOMAIN).gettext;
const { GObject, GLib, Gio, Clutter, St } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Me = ExtensionUtils.getCurrentExtension();
function lg(s){log("==="+GETTEXT_DOMAIN+"===>"+s)};

let list = [];

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
	_init() {
		let that = this;
		super._init(0.0, _('M3U8 Play'));

		const stock_icon = new St.Icon({ icon_name: 'folder-videos-symbolic', icon_size: 30 });
		this.add_child(stock_icon);

		const item_input = new PopupMenu.PopupBaseMenuItem({
                reactive: false, can_focus: false });
		const input = new St.Entry({
			name: 'searchEntry',
			secondary_icon: new St.Icon({ icon_name: 'folder-saved-search-symbolic' }),
			can_focus: true,
			hint_text: _('输入文字，搜索流媒体。'),
			x_expand: true,
		});
		input.connect('secondary-icon-clicked', ()=>{find_add_menu();});
		input.clutter_text.connect('activate', (actor) => {find_add_menu();});
		item_input.add(input);
		this.menu.addMenuItem(item_input);
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		function find_add_menu (){
			that.menu._getMenuItems().forEach((j)=>{if(j.url) j.destroy();});
			const findstr = `
#EXTINF:-1 ,追剧少女
http://112.74.200.9:88/tv000000/m3u8.php?/migu/617432318
#EXTINF:-1 ,杨幂影院
http://112.74.200.9:88/tv000000/m3u8.php?/migu/625542372
#EXTINF:-1 ,刘亦菲影视展播
http://112.74.200.9:88/tv000000/m3u8.php?/migu/639528386
`;
			const re = /#EXTINF:.{1,3}?,(.*?)\n((?:http|https|rtmp):\/\/\d.*?)\n/mg;
			list = findstr.replace(re, "$1,$2\n").split('\n');
			list.forEach(function(str, index, array){
				if(!str) return;
				const [name, add] = str.split(',');
				const item = new PopupMenu.PopupImageMenuItem("  "+name, stock_icon.icon_name);
				item.url = add;
				item.connect('activate', (actor) => {
					//~ lg(actor.url);
					GLib.spawn_command_line_async('ffplay '+actor.url);
				});
				that.menu.addMenuItem(item);
			});
		}
	}
});

class Extension {
	constructor(uuid) {
		this._uuid = uuid;
		ExtensionUtils.initTranslations(GETTEXT_DOMAIN);
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
