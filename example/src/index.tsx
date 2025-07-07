/* eslint-disable @typescript-eslint/no-explicit-any */
import '@netless/window-manager/dist/style.css';
import './index.css';
import '@netless/appliance-plugin/dist/style.css';
import { WhiteWebSdk, DeviceType, DefaultHotKeys, HotKeyEvent, KeyboardKind} from "white-web-sdk";
import { WindowManager } from "@netless/window-manager";
import { NetlessAppQuill } from "../../src/app-quill";
import { uploadImage } from './uploadImage';

const elm = document.getElementById('whiteboard') as HTMLDivElement;
const appIdentifier = '123456789/987654321';
const ctrlShiftHotKeyCheckerWith = (k:string) =>{
    return (event: HotKeyEvent, kind: KeyboardKind) => {
        const { key, altKey, ctrlKey, shiftKey, nativeEvent } = event;
        switch (kind) {
            case KeyboardKind.Mac: {
                return (
                    key === k &&
                    !ctrlKey &&
                    !altKey &&
                    shiftKey &&
                    !!nativeEvent?.metaKey
                );
            }
            case KeyboardKind.Windows: {
                return (
                    key === k &&
                    ctrlKey &&
                    !altKey &&
                    shiftKey &&
                    event.kind === "KeyDown"
                );
            }
            default: {
                return false;
            }
        }
    };

}
const whiteWebSdk = new WhiteWebSdk({
    appIdentifier,
    useMobXState: true,
    deviceType: DeviceType.Surface,
})
const uid = sessionStorage.getItem('uid') || 'uid-' + Math.floor(Math.random() * 10000);
const room = await whiteWebSdk.joinRoom({
    uuid:"cbc67f00169f11f0826bfd782d7d3846",
    roomToken:"NETLESSROOM_YWs9VWtNUk92M1JIN2I2Z284dCZleHBpcmVBdD0xNzUxOTU0OTk4NDgxJm5vbmNlPTAyOGZhNDEwLTVhZjktMTFmMC05NmE5LWFiMzg4NjE4OThhZiZyb2xlPTEmc2lnPTcyNDI1OTUxZWZiMzgwZDU4MDNiNjYyM2EyOGMzNGNiNWM5NDNhMjczZjI1OThhM2NlZjJkNTgyZDZiNTVkYmYmdXVpZD1jYmM2N2YwMDE2OWYxMWYwODI2YmZkNzgyZDdkMzg0Ng",
    uid,
    region: "cn-hz",
    isWritable: true,
    floatBar: true,
    userPayload: {
        nickName: `nickName-${uid}`,
    },
    hotKeys: {
        ...DefaultHotKeys,
        redo: ctrlShiftHotKeyCheckerWith("z"),
        changeToSelector: "s",
        changeToLaserPointer: "z",
        changeToPencil: "p",
        changeToRectangle: "r",
        changeToEllipse: "c",
        changeToEraser: "e",
        changeToText: "t",
        changeToStraight: "l",
        changeToArrow: "a",
        changeToHand: "h",
    },
    invisiblePlugins: [WindowManager as any],
    disableNewPencil: false,
    useMultiViews: true, 
})
if (room.isWritable) {
    room.setScenePath("/init");
}
const manager = await WindowManager.mount({ room , container:elm, chessboard: true, cursor: true, supportAppliancePlugin: true});
if (manager) {
    await manager.switchMainViewToWriter();
    await WindowManager.register({
        kind: 'Quill',
        src: NetlessAppQuill as any,
        appOptions: {
            options: {
                modules: {
                    cursors: true,
                    toolbar: [
                      [{ list: "ordered" }, { list: "bullet" }, { indent: "-1" }, { indent: "+1" }],
                      ["bold", "italic", "underline", "strike"],
                      ["link", "formula"],
                      ["clean"],
                    ],
                    history: {
                      userOnly: true,
                    },
                },
            },
            uploadBase64Image: async (base64Image: string) => {
                // base64Image 转 File
                const base64Data = base64Image.replace(/^data:image\/(png|jpeg|jpg|gif|webp);base64,/, '');
                const byteCharacters = atob(base64Data);
                const byteNumbers = new Array(byteCharacters.length);
                
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                
                const byteArray = new Uint8Array(byteNumbers);
                
                // 从 base64 字符串中提取文件类型
                const matches = base64Image.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,/);
                const mimeType = matches ? `image/${matches[1]}` : 'image/png';
                const fileExtension = mimeType.split('/')[1];
                
                // 创建 File 对象
                const file = new File([byteArray], `uploaded-image-${Date.now()}.${fileExtension}`, {
                    type: mimeType
                });
                
                const url = await uploadImage(file);
                return url;
            }
        }
    })
    room.disableSerialization = false;
}
window.manager = manager;

document.getElementById('addBtn')?.addEventListener('click', () => {
    manager.addApp({
        kind: 'Quill',
        attributes: {
            placeholder: 'custom placeholder'
        },
    })
});