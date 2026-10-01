export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  order: number;
};

// Snapshot of the FAQ taken from the live site when this version was archived.
// Answers may contain markdown-style links: [text](url)
export const FAQ_ITEMS: FaqItem[] = [
  {
    "id": "faq-1",
    "question": "what is SASEHacks?",
    "answer": "SASEHacks is a 24-hour long hackathon where you have the chance to build software or hardware that solves a real-world problem, showcases technical creativity, and brings unique perspectives to life. There will be multiple tracks for you to choose and spark your imagination! There will be workshops taught by CS leaders, fun activities/games, free food, and limited-edition swag items!",
    "order": 1
  },
  {
    "id": "faq-2",
    "question": "who can participate in SASEHacks?",
    "answer": "SASEHacks applications are open to any enrolled college student (undergrad or grad) from all over the world. As part of our dedication to the UF community and fostering experiential learning in early computing education, we’ll be releasing more details soon about our application review and acceptance processes.",
    "order": 2
  },
  {
    "id": "faq-3",
    "question": "what does it cost?",
    "answer": "SASEHacks is free for all admitted hackers! It's our pleasure to bring our workshops, swag, and prizes to our hackers without any cost on your end. We're committed to making SASEHacks accessible!",
    "order": 3
  },
  {
    "id": "faq-4",
    "question": "what is the SASEHacks code of conduct?",
    "answer": "We follow the [MLH Code of Conduct](https://github.com/MLH/mlh-policies/blob/main/code-of-conduct.md) and [UF Code of Conduct](https://sccr.dso.ufl.edu/policies/student-honor-code-student-conduct-code/).",
    "order": 4
  },
  {
    "id": "faq-5",
    "question": "what if i don’t have a team or idea?",
    "answer": "Many of our hackers don't have a team coming in, and find them at the event! Once your admission is confirmed, we open up a team-matching platform for you to find other teammates. We also have a ton of team-forming activities to help you find teammates and idea brainstorming sessions for all our tracks.",
    "order": 5
  },
  {
    "id": "faq-6",
    "question": "what can i build?",
    "answer": "Pick a track and build almost anything you want! If you want a prize, build something that satisfies the tracks and sponsor's challenge statements, which you can find a detailed list of on our hacker's guide and website once hacking starts. ",
    "order": 6
  }
];
