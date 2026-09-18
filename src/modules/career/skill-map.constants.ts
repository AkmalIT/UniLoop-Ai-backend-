
/**
 * Explicit mapping: learning outcome title fragment → skills produced.
 * Only outcomes that clearly demonstrate a skill are mapped.
 */
export const OUTCOME_SKILL_MAP: Record<string, string[]> = {
  'recursive': ['Algorithms', 'Python'],
  'implement recursive': ['Algorithms', 'Python'],
  'trace': ['Algorithms'],
  'base case': ['Algorithms'],
  'sql': ['SQL'],
  'database': ['SQL', 'Database Design'],
  'rest api': ['REST APIs', 'Backend Development'],
  'backend': ['REST APIs', 'Backend Development'],
  'frontend': ['HTML/CSS', 'JavaScript', 'Frontend Development'],
  'react': ['React', 'Frontend Development'],
  'data analysis': ['Data Analysis', 'Python'],
  'statistics': ['Statistics', 'Data Analysis'],
  'machine learning': ['Machine Learning', 'Python'],
};

export function mapOutcomeToSkills(outcomeTitle: string): string[] {
  const lower = outcomeTitle.toLowerCase();
  const skills = new Set<string>();
  for (const [fragment, mapped] of Object.entries(OUTCOME_SKILL_MAP)) {
    if (lower.includes(fragment)) {
      mapped.forEach((s) => skills.add(s));
    }
  }
  return Array.from(skills);
}
