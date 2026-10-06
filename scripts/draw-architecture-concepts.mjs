import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function draw(name,title,w,h,body){
 const out=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title"><title id="title">${title}</title><defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#347080"/></marker></defs><style>text{font-family:'Avenir Next','PingFang SC','Microsoft YaHei',sans-serif;font-size:20px;fill:#244451}.heading{font-size:26px;font-weight:650}.small{font-size:17px;fill:#59737e}.node{fill:white;stroke:#8aacb4;stroke-width:1.5}.accent{fill:#eaf5f5;stroke:#347080;stroke-width:2}.lane{fill:#f5f9f8;stroke:#d0e0e2;stroke-width:1.5}.edge{fill:none;stroke:#347080;stroke-width:2}.skip{fill:none;stroke:#a97530;stroke-width:2;stroke-dasharray:6 4}.cell{fill:#d8ecee;stroke:white;stroke-width:2}.masked{fill:#eceeee;stroke:white;stroke-width:2}</style><rect width="${w}" height="${h}" fill="white"/>${body}</svg>`;
 fs.writeFileSync(path.join(root,'public/assets/model-architecture',name+'.svg'),out);
}
const t=(x,y,text,cls='')=>`<text x="${x}" y="${y}" class="${cls}" text-anchor="middle">${text}</text>`;
const b=(x,y,w,h,lines,cls='node')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" class="${cls}"/>`+lines.map((s,i)=>t(x+w/2,y+h/2+7+(i-(lines.length-1)/2)*25,s)).join('');
const edge=d=>`<path d="${d}" class="edge" marker-end="url(#a)"/>`;
let body=t(460,44,'从完整生成主干，放大到一个 Decoder block','heading');
body+=b(25,80,350,730,[],'lane')+b(425,80,470,730,[],'lane');
const main=[['文本 → Token IDs'],['Embedding','X: [B,T,d]'],['Decoder block × L'],['Final Norm'],['词表投影','logits: [B,T,V]'],['末尾位置采样','追加一个新 token']];
main.forEach((s,i)=>{body+=b(60,115+i*111,280,76,s,i===2?'accent':'node');if(i<5)body+=edge(`M200 ${191+i*111}V${226+i*111}`);});
body+=t(660,111,'单层 Pre-Norm 的两次更新','heading');
const layer=[['输入 x: [B,T,d]'],['RMSNorm → Q / K / V','Q、K 上施加 RoPE'],['因果 Self-Attention → W_O'],['+ x → u'],['RMSNorm → FFN / MoE'],['+ u → y，进入下一层']];
layer.forEach((s,i)=>{body+=b(463,135+i*109,327,73,s,i===2||i===4?'accent':'node');if(i<5)body+=edge(`M626 ${208+i*109}V${244+i*109}`);});
body+='<path d="M340 375H413V134H461" class="skip" marker-end="url(#a)"/><path d="M790 172H851V498H791M790 498H834V716H791" class="skip" marker-end="url(#a)"/>';
body+=t(460,850,'每次子层更新后，主干都回到 [B,T,d]，才能做残差相加。','small');draw('decoder-block','Decoder-only 主干与准确的双残差 block',920,880,body);
body=t(450,42,'因果注意力：先算匹配权重，再汇总 V','heading');
body+=t(218,99,'可见位置矩阵（行 i 读取列 j）');
for(let i=0;i<3;i++)for(let j=0;j<3;j++){body+=`<rect x="${105+j*75}" y="${140+i*75}" width="75" height="75" class="${j<=i?'cell':'masked'}"/>`+t(142+j*75,186+i*75,j<=i?'可读':'屏蔽','small');}
['联想','总部','位于'].forEach((s,i)=>{body+=t(142+i*75,126,s,'small')+t(55,185+i*75,s,'small');});
body+=t(664,101,'末尾 query 读取所有合法位置');body+=b(472,140,386,76,['q₃ · k₁ / k₂ / k₃','缩放 → softmax'],'accent');
body+=edge('M665 216V258');body+=b(472,260,386,66,['示例权重：0.1 / 0.7 / 0.2']);body+=edge('M665 326V373');body+=b(430,375,450,77,['输出 = 0.1 v₁ + 0.7 v₂ + 0.2 v₃'],'accent');body+=t(224,421,'未来位置在 softmax 前设为 −∞','small');body+=t(450,509,'所有行在训练时并行计算；未来 token 不能进入当前行。','small');draw('attention-read','因果 mask 与加权读取示例',900,540,body);
body=t(465,44,'缓存组织变了：共享 heads 与压缩 latent 是两种机制','heading');
const names=['MHA','GQA','MLA'];names.forEach((s,i)=>{let x=25+303*i;body+=b(x,86,278,337,[],'lane')+t(x+139,125,s,'heading');if(i<2){body+=t(x+139,164,i===0?'每 head 独立 K / V':'每组共享 K / V','small');let n=i===0?4:2;for(let j=0;j<n;j++)body+=b(x+22,191+j*(i===0?49:89),234,i===0?38:65,[i===0?`head ${j+1}：K、V`:`group ${j+1}：K、V`]);}else{body+=t(x+139,164,'保存潜表示与位置分量','small')+b(x+22,191,234,75,['latent c','例如 512 维'],'accent')+b(x+22,289,234,66,['RoPE 分量','例如 64 维']);}body+=t(x+139,401,'每一层、每个历史 token','small');});
body+=b(65,459,800,135,['标准 KV 示例：8K tokens · 32 层 · head_dim 128 · FP16','32 KV heads → 4 GiB　 /　 8 KV heads → 1 GiB','MLA 使用自己的缓存维度计算，不能套用 head 数量比例'],'accent');draw('kv-memory','MHA GQA MLA 的缓存组织与显存算例',930,625,body);
body=t(450,44,'GRPO：对同一问题的一组回答作相对比较','heading');
body+=b(55,86,790,64,['问题 x → 当前策略采样 4 条回答']);body+=edge('M450 150V192');
for(let i=0;i<4;i++){body+=b(45+i*215,194,165,95,[`回答 ${i+1}`,`奖励 r = ${i<2?0:1}`],i<2?'node':'accent');}
body+=edge('M450 289V333');body+=b(55,335,790,90,['组均值 0.5 → 用奖励差估计相对优势','高于均值的样本被鼓励，低于均值的样本被抑制'],'accent');body+=edge('M450 425V464');body+=b(160,466,580,74,['计算策略优化目标 → 更新权重']);body+='<path d="M740 503H872V118H846" class="skip" marker-end="url(#a)"/>';body+=t(450,590,'更新后的策略进入下一轮采样；同组全同分时相对信号不足。','small');draw('reward-learning','GRPO 采样评分与更新策略闭环',900,620,body);
body=t(460,44,'知识管理 Agent：模型生成请求，运行时执行与记录','heading');
body+=b(30,90,860,208,[],'lane')+t(460,127,'模型侧 · 一次或多次生成','heading');
body+=b(55,162,245,97,['用户问题 + 当前状态','工具描述 + 已有证据']);body+=b(348,162,237,97,['模型前向 / 生成','结构化动作请求'],'accent');body+=b(631,162,234,97,['类型化候选','补查 / 回答 / 升级']);body+=edge('M300 210H346')+edge('M585 210H629');body+=edge('M748 259V351');
body+=b(30,329,860,244,[],'lane')+t(460,365,'运行时 · 校验、执行、状态与停止条件','heading');
body+=b(629,397,237,108,['schema / 权限校验','预算 / 超时','允许后执行工具'],'accent')+b(349,397,237,108,['检索结果 / 错误','来源与时间','写入正式状态'])+b(55,397,245,108,['校验证据 / 引用','够了就输出','不足则补查']);body+=edge('M629 450H588')+edge('M349 450H302');body+='<path d="M177 397V309H17V210H54" class="skip" marker-end="url(#a)"/>';body+=t(460,610,'工具结果回填上下文，触发下一轮；外部执行不会自动改写模型权重。','small');draw('agent-runtime','模型与知识管理 Agent 运行时闭环',920,640,body);
console.log('Drew 5 concept diagrams.');
