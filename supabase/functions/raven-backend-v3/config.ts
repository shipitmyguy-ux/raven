import type { Track } from "./types.ts";

export const GATEWAY = "https://script.google.com/macros/s/AKfycbztpeEuCsgzKX6QUqxxxuthXI0jr6jRgX5CAZiW-_RL6eTw9AlthcKJcqdd7brOHFlhhQ/exec";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

export const ATS_SOURCES=["greenhouse","lever","ashby","workday","smartrecruiters","workable","icims"] as const;
export type AtsSource=typeof ATS_SOURCES[number];

export const TRACKS: Record<Track,{
  terms:string[];
  include:string[];
  exclude:string[];
}> = {
  Professional: {
    terms:["Project Manager","Project Coordinator","Implementation Manager","Implementation Specialist","Program Manager","Operations Manager","Operations Coordinator","Training Manager","Training Specialist","Enablement Manager","Customer Success Manager","Onboarding Manager"],
    include:["project manager","project coordinator","implementation","program manager","operations manager","operations coordinator","training manager","training specialist","enablement","customer success manager","onboarding"],
    exclude:["video game","gaming","3d artist","environment artist","technical artist","software engineer","developer","construction","electrical","fire alarm","clinical","nurse","physician","architect","water","wastewater","transmission","routing","siting","public works","transportation","roads","highways","environmental remediation","restoration","power generation","power & energy","enterprise applications","it project manager","project manager - sales"]
  },
  Labor: {
    terms:["Maintenance Technician","Facilities Technician","Grounds Maintenance","Parks Maintenance","Trail Maintenance","Painter","Pressure Washing","Warehouse","Production Technician","Field Service Technician","Repair Technician","Assembly Technician","Building Maintenance","General Maintenance","Maintenance Worker","Facilities Maintenance","Groundskeeper","Custodian","Manufacturing Technician"],
    include:["maintenance technician","facilities technician","grounds maintenance","parks maintenance","trail maintenance","painter","pressure washing","warehouse","production technician","field service technician","repair technician","assembly technician","building maintenance","general maintenance","maintenance worker","facilities maintenance","groundskeeper","custodian","manufacturing technician"],
    exclude:["software","developer","engineer","nurse","clinical"]
  },
  Wildcard: {
    terms:["Operations Coordinator","Training Specialist","Implementation Specialist","Customer Success Specialist","Production Coordinator","Field Service Supervisor","Project Specialist","Onboarding Specialist","Service Coordinator","Program Coordinator"],
    include:["operations","training","implementation","customer success","production","field service","project","onboarding","service coordinator","program coordinator","supervisor"],
    exclude:["video game","gaming","3d artist","environment artist","technical artist","engineer","developer","programmer","software","clinical","nurse"]
  },
  "Games / 3D": {
    terms:["Environment Artist","Senior Environment Artist","Lead Environment Artist","World Artist","3D Environment Artist","Level Artist","Prop Artist","3D Artist","Senior 3D Artist","World Builder"],
    include:["environment artist","world artist","3d environment","level artist","prop artist","3d artist","world builder","unreal","unity","game"],
    exclude:["technical artist","character artist","vfx artist","animator","software engineer","developer"]
  }
};
