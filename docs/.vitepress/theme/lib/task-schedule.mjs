export function parseTaskTime(value) {
  if(!value)return null
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value))return NaN
  const normalized=value.length===16?value+':00':value
  const time=Date.parse(normalized+'+08:00')
  return Number.isFinite(time)&&new Date(time+28800000).toISOString().slice(0,19)===normalized?time:NaN
}
export function formatTaskTime(value) {
  return value?new Date(value+28800000).toISOString().slice(0,16):''
}
