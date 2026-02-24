"use strict";
// Contracts - Contract management and validation (to be implemented)
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContractYearsRemaining = getContractYearsRemaining;
exports.getTotalContractValue = getTotalContractValue;
function getContractYearsRemaining(contract, currentYear) {
    return Math.max(0, contract.endYear - currentYear);
}
function getTotalContractValue(contract) {
    return contract.salary * (contract.endYear - contract.startYear + 1);
}
//# sourceMappingURL=contracts.js.map