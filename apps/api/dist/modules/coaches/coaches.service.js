"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoachesService = void 0;
const PRESET_COACHES = [
    { id: "spoelstra", name: "Erik Spoelstra", imageUrl: "/images/coaches/spoelstra.png" },
    { id: "kerr", name: "Steve Kerr", imageUrl: "/images/coaches/kerr.png" },
    { id: "popovich", name: "Gregg Popovich", imageUrl: "/images/coaches/popovich.png" },
    { id: "nurse", name: "Nick Nurse", imageUrl: "/images/coaches/nurse.png" },
    { id: "mazzulla", name: "Joe Mazzulla", imageUrl: "/images/coaches/mazzulla.png" },
];
class CoachesService {
    getPresets() {
        return PRESET_COACHES;
    }
}
exports.CoachesService = CoachesService;
//# sourceMappingURL=coaches.service.js.map