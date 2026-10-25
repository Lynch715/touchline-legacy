// Workflow-only fixture: activate all five national competitions together to test
// shared controls and squad isolation. This deliberately uses legacy calendars.
// Real edition-year scheduling is verified separately in cup-rules.cjs.
module.exports=function buildAllNationalWorkflowSeason(){
 const edition=global.nationalEditionForSeason;
 global.nationalEditionForSeason=(_code,season)=>season+1;
 try{buildSeason();}finally{global.nationalEditionForSeason=edition;}
 for(const E of Object.values(WORLD.nationalCups||{})){
  delete E.calendarVersion;delete E.editionYear;
 }
};
