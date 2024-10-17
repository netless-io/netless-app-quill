#!/bin/bash

# 将生成的 iife 文件转换为 es5, 移动端动态加载时使用
BROWSERSLIST="Android 4.4, iOS 9" pnpm babel dist/index.global.js --out-file dist/index.global.es5.js --presets=@babel/preset-env --no-babelrc
