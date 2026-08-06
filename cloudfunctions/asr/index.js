const cloud = require('wx-server-sdk');
const { recognizePcm } = require('./xfyun-iat');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const fileID = event && event.fileID;
  if (!fileID) return { success: false, error: '缺少录音文件' };

  const appId = process.env.XFYUN_APP_ID;
  const apiKey = process.env.XFYUN_API_KEY;
  const apiSecret = process.env.XFYUN_API_SECRET;
  if (!appId || !apiKey || !apiSecret) {
    return { success: false, error: '讯飞语音服务尚未配置' };
  }

  try {
    const download = await cloud.downloadFile({ fileID });
    const text = await recognizePcm({
      appId,
      apiKey,
      apiSecret,
      audioBuffer: download.fileContent
    });
    return text ? { success: true, text } : { success: false, error: '没有识别到语音内容' };
  } catch (error) {
    console.error('[asr] xfyun error', error);
    return { success: false, error: '语音识别失败，请重试' };
  } finally {
    try {
      await cloud.deleteFile({ fileList: [fileID] });
    } catch (error) {
      console.error('[asr] cleanup failed', error);
    }
  }
};
