// Contracts - Contract management and validation (to be implemented)

export interface Contract {
  playerId: number;
  salary: number;
  startYear: number;
  endYear: number;
}

export function getContractYearsRemaining(contract: Contract, currentYear: number) {
  return Math.max(0, contract.endYear - currentYear);
}

export function getTotalContractValue(contract: Contract) {
  return contract.salary * (contract.endYear - contract.startYear + 1);
}
