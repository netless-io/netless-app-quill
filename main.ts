/// <reference types="vite/client" />
import { register, createFastboard, createUI } from '@netless/fastboard'
import { NetlessAppQuill } from './src'

register({
  kind: NetlessAppQuill.kind,
  src: NetlessAppQuill
})

let fastboard = await createFastboard({
  sdkConfig: {
    appIdentifier: import.meta.env.VITE_APPID || '1234567/1234567790',
    region: 'cn-hz',
  },
  joinRoom: {
    uid: Math.random().toString(36).slice(2),
    uuid: import.meta.env.VITE_ROOM_UUID || 'a76713b070d511efbf63391ee88b396c',
    roomToken: import.meta.env.VITE_ROOM_TOKEN || 'NETLESSROOM_YWs9VWtNUk92M1JIN2I2Z284dCZleHBpcmVBdD0xNzI2MjExMjQxNDQ3Jm5vbmNlPWE3YTEwZjcwLTcwZDUtMTFlZi05NmE5LWFiMzg4NjE4OThhZiZyb2xlPTEmc2lnPTQ1Zjk5YjQ1ZjY1Y2NhZWFiODYzMWVjM2VkNDIwMzQ3MDc2ZDZmZTc0MTJmN2E0OGQwNTM4ZGU0Nzg5YWNkOTUmdXVpZD1hNzY3MTNiMDcwZDUxMWVmYmY2MzM5MWVlODhiMzk2Yw',
  },
})
globalThis.fastboard = fastboard
fastboard.manager.onAppEvent('PDFjs', ev => {
  if (ev.type === 'pageStateChange')
    console.log('pageStateChange', ev.value, ev.appId)
})

fastboard.manager.emitter.on('appsChange', (apps: string[]) => {
  console.log('apps =', apps.length ? apps.join() : 'empty')
})

let ui = createUI(fastboard, document.querySelector('#whiteboard')!)
globalThis.ui = ui

document.querySelector<HTMLButtonElement>('#btn-add')!.onclick = async () => {
  console.log('add Quill')
  let appId = await fastboard.manager.addApp({
    kind: 'Quill',
  })
  console.log('new appId =', appId)
}
