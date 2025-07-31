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
    uuid:"1f47999065fe11f099f3f9fef0bf32e2",
    roomToken:"NETLESSROOM_YWs9VWtNUk92M1JIN2I2Z284dCZleHBpcmVBdD0xNzUzMTY2NjU3MTE0Jm5vbmNlPTFmNjI5YmEwLTY1ZmUtMTFmMC05NmE5LWFiMzg4NjE4OThhZiZyb2xlPTEmc2lnPTdkMTUwYzBlYjRiNDZhNjY0M2Y2MzIyMDFmZGYxODlmN2I1NjI2NTEzMmQwYzFjMWRhOTMzNjUwNDgyN2NmNjYmdXVpZD0xZjQ3OTk5MDY1ZmUxMWYwOTlmM2Y5ZmVmMGJmMzJlMg",
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
    // register quill app
    await WindowManager.register({
        kind: 'Quill',
        src: NetlessAppQuill as any,
        appOptions: {
            options: {
                modules: {
                    cursors: true,
                    toolbar: [
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

const dataTransferQuillMap:Map<string, any> = new Map();

manager.emitter.on("onAppSetup", async (appId)=>{
    const map = manager.appManager?.appProxies || new Map();
    const app = map.get(appId);
    if (app && app.kind === "Quill") {
        if (dataTransferQuillMap.has(appId)) {
            const delta = dataTransferQuillMap.get(appId);
            if (delta) {
                app.appResult.editor.setContents(delta);
                dataTransferQuillMap.delete(appId);
            }
            return;
        }
        const storage = app.appResult.storage$$.state;
        if (Object.keys(storage).length > 700) {
            const sourceQuill = app.appResult.editor;
            const delta = sourceQuill.getContents();
            // allocation according to the demands of the Quill app
            const newAppId = await manager.addApp({
                kind: 'Quill',
                attributes: {
                  placeholder: 'custom placeholder'
                }
            });
            if (newAppId) {
                dataTransferQuillMap.set(newAppId, delta);
                manager.closeApp(appId);
            }
        }
    }
})


document.getElementById('addBtn')?.addEventListener('click', () => {
    manager.addApp({
        kind: 'Quill',
        attributes: {
            placeholder: 'custom asdakdadasdj'
        },
    })
});