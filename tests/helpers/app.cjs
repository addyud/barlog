const fs=require('node:fs'),vm=require('node:vm');
function boot(saved,now='2026-09-25T12:00:00'){
 const file=require('node:path').join(__dirname,'../../index.html');
 const source=fs.readFileSync(file,'utf8').split('<script>')[1].split('</script>')[0];
 let clock=Date.parse(now),failSave=false;
 class Clock extends Date { constructor(...args){super(...(args.length?args:[clock]));} static now(){return clock;} }
 const elements=new Map(),store=new Map(saved?[['barlog.v1',JSON.stringify(saved)]]:[]);
 const context=vm.createContext({console:{...console,error(){}},Date:Clock,JSON,Math,Set,Map,Number,String,Object,Array,parseInt,isNaN,
  location:{hostname:'localhost',protocol:'http:'},navigator:{},window:{},
  localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>{if(failSave)throw Error('quota');store.set(k,v)},removeItem:k=>store.delete(k)},
  document:{getElementById:id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',value:'',style:{},classList:{add(){},remove(){}}});return elements.get(id)},createElement:()=>({style:{},remove(){}}),body:{appendChild(){}}},
  setInterval:()=>1,clearInterval(){},setTimeout:()=>1,clearTimeout(){},confirm:()=>true,alert(){}});
 vm.runInContext(source,context);
 const run=s=>vm.runInContext(s,context);
 return {run,json:s=>JSON.parse(run(`JSON.stringify(${s})`)),elements,store,
  time:v=>{clock=Date.parse(v)},fail:v=>{failSave=v},set:(k,v)=>{context[k]=v}};
}
module.exports={boot};
