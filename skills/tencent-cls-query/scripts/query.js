/**
 * 腾讯云 CLS 日志查询脚本
 * 支持: SearchLog / DescribeTopics (按主题名跨region查找)
 * 签名: TC3-HMAC-SHA256 (签名方法v3)
 */

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SECRET_ID = process.env.TENCENTCLOUD_SECRET_ID;
const SECRET_KEY = process.env.TENCENTCLOUD_SECRET_KEY;
const DEFAULT_TOPIC_ID = process.env.CLS_DEFAULT_TOPIC_ID || null;
const DEFAULT_TOPIC_NAME = process.env.CLS_DEFAULT_TOPIC_NAME || null;
const DEFAULT_REGION = process.env.CLS_DEFAULT_REGION || null;
const DECRYPT_KEY = process.env.CLS_DECRYPT_KEY || null;
const DECRYPT_TOPICS = process.env.CLS_DECRYPT_TOPICS ? process.env.CLS_DECRYPT_TOPICS.split(',').map(t => t.trim()) : [];

const CLS_REGIONS = [
  'ap-beijing', 'ap-shanghai', 'ap-guangzhou', 'ap-chengdu', 'ap-chongqing',
  'ap-nanjing', 'ap-hongkong', 'ap-singapore', 'ap-bangkok', 'ap-jakarta',
  'ap-seoul', 'ap-tokyo', 'ap-shanghai-fsi', 'ap-shenzhen-fsi',
  'eu-frankfurt', 'na-ashburn', 'na-siliconvalley', 'sa-saopaulo'
];

// ============= AES-CFB 解密 =============

/**
 * AES-CFB 解密函数
 * @param {string} ciphertext - URL安全Base64编码的密文（前16字节为IV）
 * @param {string} keyString - 32字节的密钥字符串
 * @returns {string|null} 解密后的明文，失败返回null
 */
function aesCfbDecrypt(ciphertext, keyString) {
  try {
    if (!ciphertext || !keyString) return null;

    // 密钥转Buffer（与Go的[]byte(key)对应）
    const key = Buffer.from(keyString, 'utf-8');

    // 解码URL安全Base64密文
    const decoded = Buffer.from(ciphertext, 'base64url');

    // 验证密文长度（至少16字节的IV）
    if (decoded.length < 16) {
      console.error(`密文长度太短: ${decoded.length}`);
      return null;
    }

    // 提取IV（前16字节）
    const iv = decoded.slice(0, 16);

    // 提取实际密文（从第16字节开始）
    const encryptedData = decoded.slice(16);

    // 使用AES-256-CFB解密
    const decipher = crypto.createDecipheriv('aes-256-cfb', key, iv);
    decipher.setAutoPadding(false);

    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    // 转UTF-8字符串
    const result = decrypted.toString('utf-8');

    // 验证是否为有效文本
    if (result && /[\u4e00-\u9fff\w\s]/.test(result)) {
      return result;
    }

    return result;
  } catch (error) {
    console.error(`AES解密失败: ${error.message}`);
    return null;
  }
}

/**
 * 处理日志的msg字段解密
 * @param {string} topicId - 当前查询的主题ID
 * @param {string} topicName - 当前查询的主题名称
 * @param {object} logObj - 日志JSON对象
 * @returns {object} 处理后的日志对象
 */
function processLogDecryption(topicId, topicName, logObj) {
  // 检查是否需要解密该主题（支持 topicId 或 topicName）
  if (!DECRYPT_KEY || (!DECRYPT_TOPICS.includes(topicId) && !DECRYPT_TOPICS.includes(topicName))) {
    return logObj;
  }

  // 检查msg字段是否存在且需要解密（不包含空格的认为是加密内容）
  if (logObj.msg && typeof logObj.msg === 'string' && !logObj.msg.includes(' ')) {
    const decrypted = aesCfbDecrypt(logObj.msg, DECRYPT_KEY);
    if (decrypted !== null) {
      logObj.msg = decrypted;
      console.error(`[解密成功] msg: ${decrypted.substring(0, 100)}${decrypted.length > 100 ? '...' : ''}`);
    }
  }

  return logObj;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    action: 'SearchLog',
    topicId: null,
    topicName: null,
    from: null,
    to: null,
    query: '*',
    limit: 100,
    sort: 'desc',
    syntaxRule: 1,
    region: null,
    searchRegions: null,
    output: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    switch (arg) {
      case '--action': params.action = nextArg; i++; break;
      case '--topic-id': params.topicId = nextArg; i++; break;
      case '--topic-name': params.topicName = nextArg; i++; break;
      case '--from': params.from = parseTime(nextArg); i++; break;
      case '--to': params.to = parseTime(nextArg); i++; break;
      case '--query': params.query = nextArg; i++; break;
      case '--limit': params.limit = parseInt(nextArg, 10); i++; break;
      case '--sort': params.sort = nextArg; i++; break;
      case '--syntax': params.syntaxRule = parseInt(nextArg, 10); i++; break;
      case '--region': params.region = nextArg; i++; break;
      case '--search-regions': params.searchRegions = nextArg.split(','); i++; break;
      case '--output': params.output = nextArg; i++; break;
    }
  }
  return params;
}

function parseTime(timeStr) {
  if (!timeStr) return null;
  if (/^\d+$/.test(timeStr)) return parseInt(timeStr, 10);
  if (timeStr.includes('T')) return new Date(timeStr).getTime();

  const relativeMatch = timeStr.match(/^(\d+)([smhd])$/);
  if (relativeMatch) {
    const value = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];
    const now = Date.now();
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return now - value * multipliers[unit];
  }

  const parsed = new Date(timeStr).getTime();
  if (isNaN(parsed)) throw new Error(`无法解析时间: ${timeStr}`);
  return parsed;
}

// ============= TC3-HMAC-SHA256 签名 =============

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function buildTC3Auth(secretId, secretKey, action, payload, region, timestamp) {
  const service = 'cls';
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const host = 'cls.tencentcloudapi.com';

  const canonicalRequest = [
    'POST', '/', '',
    `content-type:application/json\nhost:${host}\n`,
    'content-type;host',
    sha256(payload)
  ].join('\n');

  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    'TC3-HMAC-SHA256',
    timestamp,
    credentialScope,
    sha256(canonicalRequest)
  ].join('\n');

  const secretDate = hmacSha256(`TC3${secretKey}`, date);
  const secretService = hmacSha256(secretDate, service);
  const secretSigning = hmacSha256(secretService, 'tc3_request');
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex');

  return `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=content-type;host, Signature=${signature}`;
}

function apiRequest(action, payload, region) {
  return new Promise((resolve, reject) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const payloadStr = JSON.stringify(payload);
    const authorization = buildTC3Auth(SECRET_ID, SECRET_KEY, action, payloadStr, region, timestamp);

    const options = {
      hostname: 'cls.tencentcloudapi.com',
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Host': 'cls.tencentcloudapi.com',
        'X-TC-Action': action,
        'X-TC-Version': '2020-10-16',
        'X-TC-Timestamp': String(timestamp),
        'X-TC-Region': region,
        'Authorization': authorization
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON解析失败: ${data.substring(0, 500)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payloadStr);
    req.end();
  });
}

// ============= DescribeTopics: 按主题名查找 =============

async function findTopicByName(topicName, regions) {
  const searchRegions = regions || CLS_REGIONS;
  console.error(`正在跨region搜索主题 "${topicName}" ...`);

  const results = [];
  const batchSize = 5;
  for (let i = 0; i < searchRegions.length; i += batchSize) {
    const batch = searchRegions.slice(i, i + batchSize);
    const promises = batch.map(async (region) => {
      try {
        const resp = await apiRequest('DescribeTopics', {
          Filters: [{ Key: 'topicName', Values: [topicName] }],
          Offset: 0,
          Limit: 100,
          PreciseSearch: 1
        }, region);

        if (resp.Response && resp.Response.Topics) {
          for (const topic of resp.Response.Topics) {
            results.push({ region, topicId: topic.TopicId, topicName: topic.TopicName, logsetId: topic.LogsetId });
          }
        }
      } catch (e) {
        // skip region errors silently
      }
    });
    await Promise.all(promises);
  }

  if (results.length === 0) {
    console.error(`在所有搜索的 region 中未找到主题 "${topicName}"，尝试模糊匹配...`);
    for (let i = 0; i < searchRegions.length; i += batchSize) {
      const batch = searchRegions.slice(i, i + batchSize);
      const promises = batch.map(async (region) => {
        try {
          const resp = await apiRequest('DescribeTopics', {
            Filters: [{ Key: 'topicName', Values: [topicName] }],
            Offset: 0,
            Limit: 100,
            PreciseSearch: 0
          }, region);
          if (resp.Response && resp.Response.Topics) {
            for (const topic of resp.Response.Topics) {
              results.push({ region, topicId: topic.TopicId, topicName: topic.TopicName, logsetId: topic.LogsetId });
            }
          }
        } catch (e) {}
      });
      await Promise.all(promises);
    }
  }

  return results;
}

// ============= SearchLog =============

function formatLogEntry(log, topicId, topicName) {
  const time = new Date(log.Time).toISOString();
  let content = '';
  if (log.LogJson) {
    try {
      let logObj = JSON.parse(log.LogJson);
      // 处理解密
      logObj = processLogDecryption(topicId, topicName, logObj);
      const parts = Object.entries(logObj).map(([k, v]) => `${k}=${v}`);
      content = parts.join(' | ');
    } catch (e) {
      content = log.LogJson;
    }
  }
  return `[${time}] ${content}`;
}

function writeLogsToFile(outputPath, resp, params) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // 检查是否启用解密（支持 topicId 或 topicName）
  const decryptEnabled = DECRYPT_KEY && (DECRYPT_TOPICS.includes(params.topicId) || DECRYPT_TOPICS.includes(params.topicName));
  const decryptInfo = decryptEnabled ? `\n# 解密: 已启用 (主题在解密列表中)` : '';

  const lines = [];
  lines.push(`# CLS日志导出`);
  lines.push(`# 查询时间: ${new Date().toISOString()}`);
  lines.push(`# TopicId: ${params.topicId} | Region: ${params.region}`);
  lines.push(`# Query: ${params.query}`);
  lines.push(`# 时间范围: ${new Date(params.from).toISOString()} ~ ${new Date(params.to).toISOString()}`);
  lines.push(`# 返回条数: ${resp.Results ? resp.Results.length : 0} | 全部返回: ${resp.ListOver}${decryptInfo}`);
  lines.push('');

  if (resp.Results && resp.Results.length > 0) {
    for (const log of resp.Results) {
      lines.push(formatLogEntry(log, params.topicId, params.topicName));
    }
  } else if (resp.Analysis && resp.AnalysisRecords && resp.AnalysisRecords.length > 0) {
    if (resp.Columns) {
      lines.push('# 列: ' + resp.Columns.map(c => `${c.Name}(${c.Type})`).join(', '));
      lines.push('');
    }
    for (const record of resp.AnalysisRecords) {
      lines.push(record);
    }
  }

  if (!resp.ListOver && resp.Context) {
    lines.push('');
    lines.push(`# [未完] Context: ${resp.Context}`);
  }

  fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
}

async function searchLog(params) {
  const payload = {
    TopicId: params.topicId,
    From: params.from,
    To: params.to,
    Query: params.query,
    Limit: params.limit,
    Sort: params.sort,
    SyntaxRule: params.syntaxRule,
    UseNewAnalysis: true
  };

  const queryInfo = {
    TopicId: params.topicId,
    Region: params.region,
    From: new Date(params.from).toISOString(),
    To: new Date(params.to).toISOString(),
    Query: params.query,
    Limit: params.limit,
    Sort: params.sort,
    SyntaxRule: params.syntaxRule === 1 ? 'CQL' : 'Lucene'
  };

  console.log('========== 查询参数 ==========');
  console.log(JSON.stringify(queryInfo, null, 2));
  console.log('');

  const data = await apiRequest('SearchLog', payload, params.region);

  if (data.Response && data.Response.Error) {
    console.error(`API错误: ${data.Response.Error.Code} - ${data.Response.Error.Message}`);
    process.exit(1);
  }

  if (!data.Response) return;
  const resp = data.Response;

  // 转存模式：写文件，stdout只输出摘要
  if (params.output) {
    const outputPath = path.resolve(params.output);
    writeLogsToFile(outputPath, resp, params);
    const count = resp.Results ? resp.Results.length : (resp.AnalysisRecords ? resp.AnalysisRecords.length : 0);
    console.log('========== 转存完成 ==========');
    console.log(`文件: ${outputPath}`);
    console.log(`条数: ${count}`);
    console.log(`全部返回: ${resp.ListOver}`);
    if (!resp.ListOver && resp.Context) {
      console.log(`Context: ${resp.Context}`);
    }
    console.log(`RequestId: ${resp.RequestId}`);
    return;
  }

  // 普通模式：stdout输出全部内容
  console.log('========== 查询结果 ==========');
  console.log(`RequestId: ${resp.RequestId}`);
  console.log(`返回日志条数: ${resp.Results ? resp.Results.length : 0}`);
  console.log(`是否返回全部: ${resp.ListOver}`);
  console.log(`是否为统计分析: ${resp.Analysis}`);
  // 显示解密状态
  if (DECRYPT_KEY && (DECRYPT_TOPICS.includes(params.topicId) || DECRYPT_TOPICS.includes(params.topicName))) {
    console.log(`解密状态: 已启用`);
  }
  if (resp.SamplingRate) console.log(`采样率: ${resp.SamplingRate}`);
  console.log('');

  if (resp.Results && resp.Results.length > 0) {
    console.log('========== 日志详情 ==========');
    resp.Results.forEach((log, index) => {
      console.log(`\n--- 第 ${index + 1} 条日志 ---`);
      console.log(`时间: ${new Date(log.Time).toISOString()}`);
      if (log.TopicName) console.log(`主题: ${log.TopicName}`);
      if (log.LogJson) {
        try {
          let logObj = JSON.parse(log.LogJson);
          // 处理解密
          logObj = processLogDecryption(params.topicId, params.topicName, logObj);
          console.log('日志内容:');
          for (const [key, val] of Object.entries(logObj)) {
            console.log(`  ${key}: ${val}`);
          }
        } catch (e) {
          console.log(`日志: ${log.LogJson}`);
        }
      }
    });
  } else if (resp.Analysis && resp.AnalysisRecords && resp.AnalysisRecords.length > 0) {
    console.log('========== 统计分析结果 ==========');
    if (resp.Columns) {
      console.log('列信息:', resp.Columns.map(c => `${c.Name}(${c.Type})`).join(', '));
    }
    resp.AnalysisRecords.forEach((record, index) => {
      console.log(`\n--- 第 ${index + 1} 条 ---`);
      try {
        const obj = JSON.parse(record);
        for (const [key, val] of Object.entries(obj)) {
          console.log(`  ${key}: ${val}`);
        }
      } catch (e) {
        console.log(`  ${record}`);
      }
    });
  } else {
    console.log('未找到匹配的日志');
  }

  if (!resp.ListOver && resp.Context) {
    console.log('\n========== 提示 ==========');
    console.log(`还有更多日志未返回，可使用 Context 继续查询: ${resp.Context}`);
  }
}

// ============= 主入口 =============

async function main() {
  if (!SECRET_ID || !SECRET_KEY) {
    console.error('错误: 请设置环境变量 TENCENTCLOUD_SECRET_ID 和 TENCENTCLOUD_SECRET_KEY');
    process.exit(1);
  }

  const params = parseArgs();

  if (params.action === 'DescribeTopics') {
    if (!params.topicName) {
      console.error('错误: DescribeTopics 需要 --topic-name 参数');
      process.exit(1);
    }
    const regions = params.searchRegions || (params.region ? [params.region] : null);
    const topics = await findTopicByName(params.topicName, regions);
    console.log(JSON.stringify({ topics }, null, 2));
    return;
  }

  // 未指定主题时，使用环境变量默认值
  if (!params.topicId && !params.topicName) {
    if (DEFAULT_TOPIC_ID) {
      params.topicId = DEFAULT_TOPIC_ID;
      console.log(`使用默认主题: CLS_DEFAULT_TOPIC_ID=${DEFAULT_TOPIC_ID}`);
    } else if (DEFAULT_TOPIC_NAME) {
      params.topicName = DEFAULT_TOPIC_NAME;
      console.log(`使用默认主题: CLS_DEFAULT_TOPIC_NAME=${DEFAULT_TOPIC_NAME}`);
    }
  }
  if (!params.region && DEFAULT_REGION) {
    params.region = DEFAULT_REGION;
  }

  // 按主题名查找
  if (!params.topicId && params.topicName) {
    const regions = params.searchRegions || (params.region ? [params.region] : null);
    const topics = await findTopicByName(params.topicName, regions);
    if (topics.length === 0) {
      console.error(`错误: 未找到主题 "${params.topicName}"`);
      process.exit(1);
    }
    if (topics.length === 1) {
      params.topicId = topics[0].topicId;
      params.region = topics[0].region;
      // 保留 topicName 用于解密检查
      if (!params.topicName) {
        params.topicName = topics[0].topicName;
      }
      console.log(`自动匹配: 主题="${topics[0].topicName}" region=${topics[0].region} topicId=${topics[0].topicId}`);
    } else {
      console.log('找到多个匹配的主题:');
      topics.forEach((t, i) => console.log(`  [${i}] ${t.topicName} (region=${t.region}, id=${t.topicId})`));
      console.error('错误: 匹配到多个主题，请指定 --topic-id 和 --region，或使用更精确的主题名');
      process.exit(1);
    }
  }

  if (!params.topicId) {
    console.error('错误: 缺少 --topic-id 或 --topic-name（也可设置环境变量 CLS_DEFAULT_TOPIC_ID 或 CLS_DEFAULT_TOPIC_NAME）');
    process.exit(1);
  }
  if (!params.region) {
    console.error('错误: 缺少 --region（也可设置环境变量 CLS_DEFAULT_REGION）');
    process.exit(1);
  }
  if (!params.from) {
    console.error('错误: 缺少 --from');
    process.exit(1);
  }
  if (!params.to) {
    params.to = Date.now();
  }

  await searchLog(params);
}

main().catch(err => {
  console.error('执行失败:', err.message);
  process.exit(1);
});
