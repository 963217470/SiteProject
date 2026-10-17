export function deadlineCountdown(deadline, now) {
  let seconds = Math.max(0, Math.ceil((deadline - now) / 1000))
  const days = Math.floor(seconds / 86400); seconds %= 86400
  const hours = Math.floor(seconds / 3600); seconds %= 3600
  const minutes = Math.floor(seconds / 60); seconds %= 60
  return [days, hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':')
}
