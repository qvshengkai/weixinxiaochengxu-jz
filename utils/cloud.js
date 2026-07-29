// utils/cloud.js — 云函数调用封装（Promise 化）
const call = (name, data = {}) => {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({ name, data })
      .then(res => {
        const result = res.result || {};
        // 云函数抛异常时，微信会把错误包成 { error: { errMsg, ... } }
        if (result.error) {
          reject(new Error(result.error.errMsg || '云函数执行异常'));
          return;
        }
        // 云函数统一返回 { code, data, message }
        if (result.code === 0 || result.code === undefined) {
          resolve(result.data);
        } else {
          reject(new Error(result.message || 'callFunction failed'));
        }
      })
      .catch(reject);
  });
};

module.exports = { call };
