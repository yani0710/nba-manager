/**
 * Format utility functions
 */

export function formatSalary(salary) {
  if (salary >= 1000000) {
    return `$${(salary / 1000000).toFixed(2)}M`;
  }
  return `$${salary.toLocaleString()}`;
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString();
}

export function formatTeamName(name) {
  return name.split(' ').pop(); // Get last word (e.g., "Lakers" from "Los Angeles Lakers")
}

export function getTeamColor(teamName) {
  // Map team names to their brand colors
  const colors = {
    Lakers: '#FDB927',
    Warriors: '#1D428A',
    Celtics: '#007A33',
    Heat: '#98002E',
    Nuggets: '#0E2240',
    Suns: '#E56020',
    Knicks: '#F58426',
    Clippers: '#ED174C',
    Mavericks: '#002B5C',
    Bulls: '#CE1141',
  };

  const key = formatTeamName(teamName);
  return colors[key] || '#4ade80';
}
