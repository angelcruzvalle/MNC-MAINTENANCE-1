export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "OPENAI_API_KEY is not configured on the server." });
  try {
    const documents = Array.isArray(req.body?.documents) ? req.body.documents : [];
    const images = documents.filter(d => typeof d?.dataUrl === "string" && d.dataUrl.startsWith("data:image/"));
    if (!images.length) return res.status(400).json({ error: "At least one image scan is required for AI analysis. PDF-only AI import is not enabled yet." });
    if (images.length > 8) return res.status(400).json({ error: "Analyze up to 8 photographed pages at a time." });

    const schema = {
      type:"object", additionalProperties:false,
      properties:{
        title:{type:["string","null"]}, woType:{type:["string","null"],enum:["Repair","Service","Inspection",null]},
        created:{type:["string","null"]}, completed:{type:["string","null"]}, fault:{type:["string","null"]},
        workPerformed:{type:["string","null"]}, tech:{type:["string","null"]}, laborHours:{type:["number","null"]}, laborCost:{type:["number","null"]},
        partsUsed:{type:"array",items:{type:"object",additionalProperties:false,properties:{name:{type:["string","null"]},partNumber:{type:["string","null"]},qty:{type:["number","null"]},unitCost:{type:["number","null"]}},required:["name","partNumber","qty","unitCost"]}},
        missing:{type:"array",items:{type:"string"}}, confidence:{type:"object",additionalProperties:{type:"string"}}
      }, required:["title","woType","created","completed","fault","workPerformed","tech","laborHours","laborCost","partsUsed","missing","confidence"]
    };
    const content=[{type:"input_text",text:`Read these photographed historical maintenance work-order pages. The equipment is already selected in MaintForge, so DO NOT identify equipment. Extract only visible/supportable maintenance facts. Never guess. Dates must be YYYY-MM-DD or null. Classify type as Repair, Service, or Inspection only when supported. 'fault' is the complaint/problem; 'workPerformed' is corrective action/service performed. Extract parts as separate rows with quantity and unit cost when visible. If a total part cost is visible but unit cost is not, do not invent unit cost. Put important unfilled basic fields in missing. Confidence values may be high, medium, or low. Handwriting may be imperfect: use null instead of guessing.`}, ...images.map(d=>({type:"input_image",image_url:d.dataUrl,detail:"high"}))];
    const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.MAINTFORGE_VISION_MODEL||"gpt-6-luna",input:[{role:"user",content}],text:{format:{type:"json_schema",name:"historical_work_order",strict:true,schema}}})});
    const raw=await r.json();
    if(!r.ok) return res.status(r.status).json({error:raw?.error?.message||"OpenAI vision request failed."});
    const outputText=raw.output_text || (raw.output||[]).flatMap(x=>x.content||[]).find(x=>x.type==="output_text")?.text;
    if(!outputText) return res.status(502).json({error:"AI returned no structured work-order data."});
    return res.status(200).json({data:JSON.parse(outputText)});
  } catch (err) { return res.status(500).json({error:err?.message||"Historical work-order analysis failed."}); }
}
