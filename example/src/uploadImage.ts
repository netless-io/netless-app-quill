/* eslint-disable @typescript-eslint/no-explicit-any */

// OSS签名响应类型
export interface OSSSignature {
  accessKeyId: string;
  policy: string;
  signature: string;
  dir: string;
  host: string;
  expire: number;
  signedUrl: string; // 签名后的URL
  filename: string; // 生成的文件名
}

// 获取OSS签名
export const getOSSSignature = async (file: File): Promise<OSSSignature> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
  
  try {
    // 使用代理URL，避免跨域问题
    const response = await fetch('https://getosssignature-white-be-backup-dhyeefqsaw.cn-hangzhou.fcapp.run', {
      method: 'POST',
      body: JSON.stringify({ filename: file.name, type: file.type, action: 'getOSSSignature' }),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`获取OSS签名失败: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('🔑 获取OSS签名成功', result);
    
    // 检查响应格式
    if (result.code === '0' && result.data) {
      return result.data;
    } else {
      throw new Error(result.message || '响应格式错误');
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('请求超时，请检查网络连接');
    }
    throw error;
  }
};

// 直接上传文件到OSS
export const uploadToOSS = async (file: File, signature: OSSSignature): Promise<string> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时

  try {
    const response = await fetch(signature.signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type
      },
      body: file,
      signal: controller.signal,
    });
    console.log('🔑 上传到OSS 响应', response);

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`上传到OSS失败: ${response.status}`);
    }

    // 返回文件URL
    return `${signature.host}/${signature.filename}`;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('上传超时，请检查网络连接');
    }
    throw error;
  }
};

// 主上传函数
export const uploadImage = async (image: File) => {
  try {
    // 1. 获取OSS签名
    console.log('🔑 获取OSS签名...');
    const signature = await getOSSSignature(image);
    console.log('✅ OSS签名获取成功');
  
    // 2. 直接上传文件到OSS
    console.log('📤 上传文件到OSS...');
    const fileUrl = await uploadToOSS(image, signature);
    console.log(`✅ 文件上传成功: ${fileUrl}`);

    return fileUrl;
  } catch (error) {
    console.error('❌ 上传文件失败:', error);
    throw error;
  }
};