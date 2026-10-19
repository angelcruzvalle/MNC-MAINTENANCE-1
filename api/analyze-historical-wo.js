const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
};

function extractOutputText(data) {
  if (typeof data?.output_text === "string") return data.output_text;
  for (const item of data?.output || []) {
    for (const c of item?.content || []) {
      if (typeof c?.text === "string") return c.text;
    }
  }
  return "";
}

function parseJsonText(text) {
  const cleaned = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json(res, 503, { code: "AI_NOT_CONFIGURED", error: "AI Import is not configured on the server." });

  const documents = Array.isArray(req.body?.documents) ? req.body.documents.slice(0, 8) : [];
  if (!documents.length) return json(res, 400, { error: "No scanned work-order pages were provided." });
  const unsupported = documents.find(d => !String(d?.dataUrl || "").startsWith("data:image/"));
  if (unsupported) return json(res, 400, { error: `AI scan currently accepts image pages (JPG/PNG/HEIC converted by the browser). “${unsupported.name || "A file"}” is not an image. For a PDF, save or scan its pages as images first.` });

  const content = [{
    type: "input_text",
    text: `Read these scanned historical maintenance work-order pages. Return ONLY valid JSON with this exact shape: {"title":"","woType":"Repair|Service|Inspection","created":"YYYY-MM-DD or empty","completed":"YYYY-MM-DD or empty","fault":"","tech":"","laborHours":0,"laborCost":0,"workPerformed":"","notes":"","partsUsed":[{"name":"","partNumber":"","qty":1,"unitCost":0}],"confidence":{"overall":"high|medium|low"},"missing":[]}. Do not invent unreadable values. Put uncertain or unreadable fields in missing. Preserve useful maintenance wording from the document while keeping it concise.`
  }];
  for (const doc of documents) content.push({ type: "input_image", image_url: doc.dataUrl, detail: "high" });

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5.6-sol", input: [{ role: "user", content }], max_output_tokens: 1800 })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json(res, r.status, { error: data?.error?.message || `OpenAI request failed (${r.status}).` });
    const text = extractOutputText(data);
    if (!text) return json(res, 502, { error: "AI returned no readable result." });
    let parsed;
    try { parsed = parseJsonText(text); }
    catch { return json(res, 502, { error: "AI read the document but returned an invalid result. Please try the scan again." }); }
    return json(res, 200, { data: parsed });
  } catch (err) {
    return json(res, 502, { error: err?.message || "Could not reach the AI service." });
  }
}
