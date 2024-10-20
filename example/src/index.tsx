/* eslint-disable @typescript-eslint/no-explicit-any */
import '@netless/window-manager/dist/style.css';
import './index.css';
import '@netless/appliance-plugin/dist/style.css';
import { WhiteWebSdk, DeviceType, DefaultHotKeys, HotKeyEvent, KeyboardKind} from "white-web-sdk";
import { WindowManager } from "@netless/window-manager";
import { ApplianceMultiPlugin } from '@netless/appliance-plugin';
import fullWorkerString from '@netless/appliance-plugin/dist/fullWorker.js?raw';
import subWorkerString from '@netless/appliance-plugin/dist/subWorker.js?raw';

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
    // apiHosts: [
    //     "api-cn-hz.netless.group",
    // ],
})
const uid = sessionStorage.getItem('uid') || 'uid-' + Math.floor(Math.random() * 10000);
const room = await whiteWebSdk.joinRoom({
    uuid:"ec61e0108d4211ef83863d0682a6c9bd",
    roomToken:"NETLESSROOM_YWs9VWtNUk92M1JIN2I2Z284dCZleHBpcmVBdD0xNzI5MzM2ODA0Njg2Jm5vbmNlPWVjN2ViNmUwLThkNDItMTFlZi05NmE5LWFiMzg4NjE4OThhZiZyb2xlPTEmc2lnPTcwODZkNWRkOWQ2ZGFkZGE1ZDg3NTA5MjRmZGZiMDAxYmNmNWZkMjA1ODBlMmY5OWMwZmNjODdiMTBmNTE0MzMmdXVpZD1lYzYxZTAxMDhkNDIxMWVmODM4NjNkMDY4MmE2YzliZA",
    uid,
    region: "cn-hz",
    isWritable: true,
    floatBar: true,
    userPayload: {
        // userId: uid.split('uid-')[1],
        // userUUID: uid,
        // cursorName: `user-${uid}`,
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
    invisiblePlugins: [WindowManager as any, ApplianceMultiPlugin],
    disableNewPencil: false,
    useMultiViews: true, 
})
if (room.isWritable) {
    room.setScenePath("/init");
}
const manager = await WindowManager.mount({ room , container:elm, chessboard: true, cursor: true, supportAppliancePlugin: true});
if (manager) {
    await manager.switchMainViewToWriter();
    const fullWorkerBlob = new Blob([fullWorkerString], {type: 'text/javascript'});
    const fullWorkerUrl = URL.createObjectURL(fullWorkerBlob);
    const subWorkerBlob = new Blob([subWorkerString], {type: 'text/javascript'});
    const subWorkerUrl = URL.createObjectURL(subWorkerBlob);
    const plugin = await ApplianceMultiPlugin.getInstance(manager,
        {   // 获取插件实例，全局应该只有一个插件实例，必须在 joinRoom 之后调用
            options: {
                cdn: {
                    fullWorkerUrl,
                    subWorkerUrl
                }
            }
        }
    );
    await WindowManager.register({
        kind: 'Quill',
        src: () => import("../../src/index")
    })
    room.disableSerialization = false;
    window.appliancePlugin = plugin;
}
window.manager = manager;

document.getElementById('addBtn')?.addEventListener('click', () => {
    manager.addApp({
        kind: 'Quill',
    })
});