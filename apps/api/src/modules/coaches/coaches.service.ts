const PRESET_COACHES = [
  { id: "spoelstra", name: "Erik Spoelstra", imageUrl: "/images/coaches/Spoelstra.webp", specialty: "Defense", style: "Tactical Style" },
  { id: "kerr", name: "Steve Kerr", imageUrl: "/images/coaches/kerr.jpg", specialty: "Offense", style: "Motion Style" },
  { id: "popovich", name: "Gregg Popovich", imageUrl: "/images/coaches/popovich.jpg", specialty: "All-Round", style: "Veteran Style" },
  { id: "nurse", name: "Nick Nurse", imageUrl: "/images/coaches/Nurse.webp", specialty: "Innovation", style: "Modern Style" },
  { id: "mazzulla", name: "Joe Mazzulla", imageUrl: "/images/coaches/Mazzulla.jpg", specialty: "Analytics", style: "Progressive Style" },
];

export class CoachesService {
  getPresets() {
    return PRESET_COACHES;
  }
}
