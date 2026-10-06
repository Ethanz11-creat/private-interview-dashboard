import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const models=JSON.parse(fs.readFileSync(path.join(root,'content/architecture/models.json'),'utf8'));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
for(const m of models){
 let parts=[];
 const text=(x,y,s,cls='label',anchor='middle')=>parts.push(`<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${esc(s)}</text>`);
 const box=(x,y,w,h,lines,cls='node')=>{parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" class="${cls}"/>`);lines.forEach((s,i)=>text(x+w/2,y+h/2+(i-(lines.length-1)/2)*25+7,s));};
 const line=(d,cls='edge')=>parts.push(`<path d="${d}" class="${cls}" marker-end="url(#arrow)"/>`);
 parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="1180" viewBox="0 0 1040 1180" role="img" aria-labelledby="title desc"><title id="title">${esc(m.name)} 架构展开图</title><desc id="desc">左侧从下向上展示 embedding、归一化、${esc(m.attention)}、残差和 MoE；右侧展开注意力计算与 ${m.experts} 个路由专家中的 Top-${m.top} 选择。图中细粒度配置已对照发布 checkpoint，正文标明版本差异。</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#345866"/></marker></defs><style>text{font-family:'Avenir Next','PingFang SC','Microsoft YaHei',sans-serif;fill:#244451}.label{font-size:20px}.title{font-size:34px;font-weight:700;fill:${m.color}}.subtitle{font-size:18px;fill:#627982}.heading{font-size:23px;font-weight:650}.small{font-size:17px}.note{font-size:19px;fill:${m.color};font-weight:600}.node{fill:white;stroke:#688d99;stroke-width:1.5}.accent{fill:${m.color}12;stroke:${m.color};stroke-width:2}.edge{fill:none;stroke:#345866;stroke-width:2}.skip{fill:none;stroke:#a97430;stroke-width:2;stroke-dasharray:6 4}.callout{fill:none;stroke:${m.color};stroke-width:2;stroke-dasharray:4 5}.frame{fill:#f5f9f8;stroke:#d0e0e2;stroke-width:1.5}</style><rect width="1040" height="1180" fill="#fff"/>`);
 text(38,53,m.name,'title','start');text(38,85,`${m.total} 总参数 · ${m.active} 每 token 激活参数`,'subtitle','start');
 parts.push('<rect x="55" y="123" width="390" height="900" rx="24" class="frame"/>');
 text(250,158,'生成主干 · 从下向上读','heading');
 parts.push(`<rect x="94" y="338" width="309" height="490" rx="20" class="accent"/>`);
 box(134,950,230,48,['Token IDs']);box(134,873,230,52,['Embedding']);
 box(134,748,230,54,['RMSNorm']);
 box(120,627,258,85,m.attentionLines,'accent');
 box(134,486,230,56,['RMSNorm']);box(134,394,230,52,['MoE / Dense FFN'],'accent');
 box(134,245,230,52,['Final RMSNorm']);box(134,180,230,46,['词表投影 → logits']);
 for(const [y1,y2] of [[950,925],[873,802],[748,712],[627,593],[563,542],[486,446],[394,367],[337,297],[245,226]])line(`M249 ${y1}V${y2}`);
 for(const cy of [578,352]){parts.push(`<circle cx="249" cy="${cy}" r="15" fill="white" stroke="#345866" stroke-width="2"/>`);text(249,cy+7,'+','heading');}
 line('M249 815H393V578H265','skip');line('M249 555H386V352H265','skip');
 text(112,843,`重复 ${m.layers} 层`,'note','start');text(80,1054,`隐藏维度 d = ${m.hidden}`,'note','start');text(80,1084,m.dense,'small','start');text(80,1114,'虚线支路：旧表示 + 子层更新','small','start');
 parts.push('<rect x="492" y="123" width="511" height="399" rx="18" class="frame"/>');text(748,158,'① 注意力模块展开','heading');
 const a=m.kind;
 if(a==='mla'||a==='dsa'){
  box(518,426,458,54,['当前 token 表示 x']);
  box(518,322,204,69,['Q 投影','生成 query']);box(754,322,222,69,['KV 下投影','低维 latent c']);
  line('M620 426V391');line('M865 426V391');
  box(518,221,458,66,[a==='dsa'?'Indexer 选位置 → MLA 读所选 KV':'Q 与历史压缩 KV 计算注意力'],'accent');
  line('M620 322V287');line('M865 322V287');
  text(747,197,a==='dsa'?'压缩“存什么” + 稀疏“看哪里”':'缓存 latent 与独立 RoPE 分量','note');
 }else if(a==='hybrid'){
  box(518,426,458,54,['当前 token 表示 x']);
  box(518,254,215,112,['Gated DeltaNet','更新矩阵状态 S','压缩历史'],'accent');
  box(752,254,225,112,['Gated Attention','读取历史 K / V','保留精确寻址'],'accent');
  line('M747 426V400H625V366');line('M747 400H865V366');
  text(747,207,'不同层使用不同 token mixer','note');text(747,233,'不是同一层同时走两条注意力支路','small');
  text(747,389,'门控控制更新或输出的通过量','small');
 }else{
  box(518,426,458,54,['当前 token 表示 x']);
  box(518,322,204,69,['多组 Q heads','RoPE / QK Norm']);box(754,322,222,69,['少量 K / V heads','组内共享 KV']);
  line('M620 426V391');line('M865 426V391');
  box(518,221,458,66,[a==='swa'?'3 层局部窗口 : 1 层全局注意力':'分组查询 → softmax(QKᵀ / √d) V'],'accent');
  line('M620 322V287');line('M865 322V287');text(747,197,a==='swa'?'局部层省预算 · 全局层连接远端':'Q head 数量可以大于 KV head 数量','note');
 }
 parts.push('<path d="M378 668H469V487H492" class="callout"/>');
 parts.push('<rect x="492" y="554" width="511" height="559" rx="18" class="frame"/>');text(748,591,'② MoE 替换前馈模块','heading');
 box(629,994,242,54,['归一化后的 token']);box(629,898,242,57,[`Router → Top-${m.top}`],'accent');line('M750 994V955');
 box(510,772,140,83,['Expert 1','SwiGLU']);box(690,772,140,83,['…','SwiGLU']);box(861,772,124,83,[`E ${m.experts}`,'SwiGLU']);
 line('M750 898V877H580V855');line('M750 877V855');line('M750 877H923V855');
 box(578,654,363,65,[m.shared?`加权合并 + ${m.shared} 个共享专家`:'所选专家输出加权合并'],'accent');
 line('M580 772V741H750V719');line('M760 772V719');line('M923 772V741H760V719');
 text(748,627,`${m.experts} 个可选专家 · 每次选 ${m.top} 个`,'note');
 if(m.shared){
  box(883,898,112,57,['共享','专家'],'accent');
  line('M871 1021H939V955','skip');line('M939 898H994V686H943','skip');
 }
 text(748,1078,m.shared?'共享专家每个 token 都经过':'本图没有共享专家支路','small');
 parts.push('<path d="M364 420H471V590H492" class="callout"/>');
 text(38,1153,'主干为语言部分简化图；数值已对照发布配置；完整版本与差异见图下说明。','subtitle','start');
 parts.push('</svg>');fs.writeFileSync(path.join(root,'public/assets/model-architecture',`${m.id}.svg`),parts.join('\n'));
}
console.log(`Drew ${models.length} model architecture SVGs.`);
