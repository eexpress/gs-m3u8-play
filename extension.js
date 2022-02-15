const GETTEXT_DOMAIN = 'm3u8-play';	//这行说指向翻译的 mo 文件名的关键
const _ = imports.gettext.domain(GETTEXT_DOMAIN).gettext;
const { GObject, GLib, Gio, Clutter, St } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Me = ExtensionUtils.getCurrentExtension();
function lg(s){log("==="+GETTEXT_DOMAIN+"===>"+s)};
const ByteArray = imports.byteArray;

let list = [];	//name,url
let favor = [];	//name,url

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
	_init() {
		let that = this;
		// read all m3u8 files.
		const m3u8path = GLib.get_home_dir()+"/.local/share/m3u8-play/";
		const favorfile = m3u8path+"favor.list";
		if(GLib.file_test(favorfile, GLib.FileTest.IS_REGULAR)){
			const [ok, content] = GLib.file_get_contents(favorfile);
			if(ok){	favor = ByteArray.toString(content).split('\n'); }
		}
		const tempfile = "/tmp/m3u8.all";
		let urllist = '';
		try{
			if(!GLib.file_test(tempfile, GLib.FileTest.IS_REGULAR)){
				GLib.spawn_command_line_sync(`cat ${m3u8path}*.m3u* > ${tempfile}`);
			}
			urllist = ByteArray.toString(GLib.file_get_contents(tempfile)[1]);
		}catch(e){lg("Read URLs fail.");}

		if(!urllist){
			urllist = `
#EXTINF:-1 ,追剧少女
http://112.74.200.9:88/tv000000/m3u8.php?/migu/617432318
#EXTINF:-1 ,杨幂影院
http://112.74.200.9:88/tv000000/m3u8.php?/migu/625542372
#EXTINF:-1 ,刘亦菲影视展播
http://112.74.200.9:88/tv000000/m3u8.php?/migu/639528386
#EXTINF:-1 group-title="MIGU电影轮播" tvg-logo="https://s9.rr.itc.cn/r/wapChange/20171_22_18/a4a8u5974032374500.jpeg",MIGU刘亦菲影视展播
http://117.148.179.134/PLTV/88888888/224/3221231787/index.m3u8
#EXTINF:-1 ,黑莓電影
http://183.207.249.14/PLTV/3/224/3221225567/index.m3u8
#EXTINF:-1 ,CHC家庭電影
http://39.134.18.65/dbiptv.sn.chinamobile.com/PLTV/88888888/224/3221226462/1.m3u8
#EXTINF:-1 ,CHC動作電影
http://39.134.18.66/dbiptv.sn.chinamobile.com/PLTV/88888888/224/3221226465/1.m3u8
#EXTINF:-1 ,玄幻影院
https://tx.liveplay.live.kugou.com/live/fx_hifi_1308614369_avc.m3u8
`;
		}

		const re = /#EXTINF:.*?,(.+?)\r*\n((?:http|https|rtmp):\/\/.+?)\r*\n/mg;
		list = urllist.replace(re, "$1,$2\n").split('\n');
		lg("3:"+list);
		//~ lg(`cat ${m3u8path}*.m3u* > ${tempfile}`);

		super._init(0.0, _('M3U8 Play'));

		const stock_icon = new St.Icon({ icon_name: 'folder-videos-symbolic', icon_size: 30 });
		this.add_child(stock_icon);

		const item_input = new PopupMenu.PopupBaseMenuItem({
                reactive: false, can_focus: false });
		const input = new St.Entry({
			name: 'searchEntry',
			primary_icon: new St.Icon({ icon_name: 'edit-clear-all-symbolic', icon_size: 24 }),
			secondary_icon: new St.Icon({ icon_name: 'folder-saved-search-symbolic', icon_size: 24 }),
			can_focus: true,
			hint_text: _('输入文字，搜索流媒体。'),
			x_expand: true,
		});
		input.connect('primary-icon-clicked', ()=>{ input.text = '';});
		input.connect('secondary-icon-clicked', ()=>{find_add_menu();});
		input.clutter_text.connect('activate', (actor) => {find_add_menu();});
		item_input.add(input);
		this.menu.addMenuItem(item_input);
		add_favor();

		function refresh_menu(){
			that.menu._getMenuItems().forEach((j)=>{if(!j === item_input) j.destroy();});
			add_favor();
		}

		function add_favor(){
			favor.forEach((str,i,arr) => {
				if(str.includes(',')){
					const [name, url] = str.split(',');
					add_menu(name, url, true);
				}
			});
		}

		function find_add_menu(){
			//~ that.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			let s = input.text;
			if(!s) return;
			that.menu._getMenuItems().forEach((j)=>{if(!j.favor && j.url) j.destroy();});
			list.forEach(function(str, index, array){
				if(!str) return;
				//~ lg("1"+str);
				if(favor.indexOf(str)>=0) return;
				//~ lg("2");
				const [name, url] = str.split(',');
				if(!name.includes(s)) return;
				//~ lg("3");
				//~ lg(str);
				add_menu(name, url, false);
			});
		}

		function add_menu(name, url, is_favor){
			const icon_find0 = "view-app-grid-symbolic";
			const icon_find1 = "value-increase-symbolic";
			const icon_favor0 = "star-new-symbolic";
			const icon_favor1 = "value-decrease-symbolic";
			const item = new PopupMenu.PopupImageMenuItem("  "+name, is_favor ? icon_favor0 : icon_find0);
			item._icon.set_reactive(true);
			item.url = url;
			item.favor = is_favor;
			item._icon.connect('enter-event', (actor) => {
				item.setIcon(item.favor ? icon_favor1 : icon_find1);
			});
			item._icon.connect('leave-event', (actor) => {
				item.setIcon(item.favor ? icon_favor0 : icon_find0);
			});
			item._icon.connect('button-release-event', (actor) => {
				if(item.favor){
					lg("remove from favor.");
					delete favor[favor.indexOf(name+","+url)];
					save_favor();
					that.menu.moveMenuItem(item, that.menu._getMenuItems().length - 1);
					item.favor = false;
					//~ actor.favor = false;
					item.setIcon(icon_find0);
				}else{
					lg("add to favor.");
					favor.push(name+","+url);
					save_favor();
					that.menu.moveMenuItem(item, 1);
					item.favor = true;
					//~ actor.favor = true;
					item.setIcon(icon_favor0);
				}
				return Clutter.EVENT_STOP;
			});
			item.connect('activate', (actor) => {
				GLib.spawn_command_line_async('ffplay '+actor.url);
			});
			that.menu.addMenuItem(item);
		};

		function save_favor(){
			let out = '';
			favor.forEach((str) => {
				if(str.includes(',')){ out += str+'\n'; }
			});
			GLib.file_set_contents(favorfile,out);
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
