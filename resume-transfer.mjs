export const REQUEST_KEY="ravenChatGptRequestsV1";
export function filePrompt(prompt,requestId){
  return prompt+"\n\nFILE DELIVERY (overrides the earlier response-format instruction): Create a downloadable UTF-8 JSON file named raven-"+requestId+".json using your file creation tool. Put the complete Raven JSON object in that file, adding a top-level request_id with the exact value "+JSON.stringify(requestId)+". Preserve raven_format and all fact_ids. Reply with only the file download link; do not print the resume or JSON in the conversation. If file creation is unavailable, say so; do not claim to have created a file.";
}
export function matchRequest(payload,requests,now=Date.now()){
  if(payload?.raven_format!=="raven-chatgpt-v1")throw new Error("Unsupported Raven JSON file.");
  const request=requests?.[payload.request_id];
  if(!request||now-request.createdAt>24*60*60*1000||now<request.createdAt)throw new Error("This file has no active Raven request. Use Import on the correct job.");
  const types=request.type==="both"?["resume","coverLetter"]:[request.type];
  if(types.some(type=>!payload[type]))throw new Error("The JSON file is missing a requested document.");
  return request;
}
