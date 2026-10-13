export function experience(db, user) {
  return db.prepare('SELECT (SELECT coalesce(sum(amount),0) FROM experience_ledger WHERE user_id=? AND amount>0)+(SELECT coalesce(sum(amount),0) FROM community_experience WHERE user_id=?) xp').get(user, user).xp
}
export function formalThreshold(db) {
  return db.prepare('SELECT threshold FROM experience_levels ORDER BY threshold LIMIT 1 OFFSET 2').get()?.threshold ?? 300
}
export function formalMember(db, user) {
  return user?.role === 'admin' || !!(user && ['user', 'member'].includes(user.role) && experience(db, user.id) >= formalThreshold(db))
}
