// MLH Schools List
// Based on common schools participating in MLH hackathons
// Users can search this list or enter a custom school name

export type School = {
  id: string;
  name: string;
};

export const mlhSchools: School[] = [
  // Florida Schools (prioritized for UF SASE Hacks)
  { id: "university-of-florida", name: "University of Florida" },
  { id: "florida-state-university", name: "Florida State University" },
  { id: "university-of-central-florida", name: "University of Central Florida" },
  { id: "university-of-south-florida", name: "University of South Florida" },
  { id: "florida-international-university", name: "Florida International University" },
  { id: "florida-atlantic-university", name: "Florida Atlantic University" },
  { id: "university-of-miami", name: "University of Miami" },
  { id: "florida-institute-of-technology", name: "Florida Institute of Technology" },
  { id: "florida-am-university", name: "Florida A&M University" },
  { id: "university-of-north-florida", name: "University of North Florida" },
  { id: "florida-gulf-coast-university", name: "Florida Gulf Coast University" },
  { id: "stetson-university", name: "Stetson University" },
  { id: "rollins-college", name: "Rollins College" },
  { id: "embry-riddle-aeronautical-university", name: "Embry-Riddle Aeronautical University" },
  { id: "santa-fe-college", name: "Santa Fe College" },
  { id: "valencia-college", name: "Valencia College" },
  { id: "miami-dade-college", name: "Miami Dade College" },
  { id: "broward-college", name: "Broward College" },

  // Top US Universities
  { id: "massachusetts-institute-of-technology", name: "Massachusetts Institute of Technology" },
  { id: "stanford-university", name: "Stanford University" },
  { id: "harvard-university", name: "Harvard University" },
  { id: "california-institute-of-technology", name: "California Institute of Technology" },
  { id: "princeton-university", name: "Princeton University" },
  { id: "yale-university", name: "Yale University" },
  { id: "columbia-university", name: "Columbia University" },
  { id: "university-of-chicago", name: "University of Chicago" },
  { id: "duke-university", name: "Duke University" },
  { id: "northwestern-university", name: "Northwestern University" },
  { id: "johns-hopkins-university", name: "Johns Hopkins University" },
  { id: "cornell-university", name: "Cornell University" },
  { id: "brown-university", name: "Brown University" },
  { id: "university-of-pennsylvania", name: "University of Pennsylvania" },
  { id: "dartmouth-college", name: "Dartmouth College" },
  { id: "carnegie-mellon-university", name: "Carnegie Mellon University" },
  { id: "georgia-institute-of-technology", name: "Georgia Institute of Technology" },
  { id: "university-of-michigan", name: "University of Michigan" },
  { id: "university-of-california-berkeley", name: "University of California, Berkeley" },
  { id: "university-of-california-los-angeles", name: "University of California, Los Angeles" },
  { id: "university-of-california-san-diego", name: "University of California, San Diego" },
  { id: "university-of-california-irvine", name: "University of California, Irvine" },
  { id: "university-of-california-davis", name: "University of California, Davis" },
  { id: "university-of-california-santa-barbara", name: "University of California, Santa Barbara" },
  { id: "university-of-california-santa-cruz", name: "University of California, Santa Cruz" },
  { id: "university-of-california-riverside", name: "University of California, Riverside" },
  { id: "california-state-university-long-beach", name: "California State University, Long Beach" },
  { id: "san-jose-state-university", name: "San Jose State University" },
  { id: "california-polytechnic-state-university", name: "California Polytechnic State University" },

  // Other Major US Universities
  { id: "university-of-texas-austin", name: "University of Texas at Austin" },
  { id: "texas-am-university", name: "Texas A&M University" },
  { id: "university-of-washington", name: "University of Washington" },
  { id: "university-of-illinois-urbana-champaign", name: "University of Illinois Urbana-Champaign" },
  { id: "purdue-university", name: "Purdue University" },
  { id: "ohio-state-university", name: "Ohio State University" },
  { id: "university-of-wisconsin-madison", name: "University of Wisconsin-Madison" },
  { id: "university-of-minnesota", name: "University of Minnesota" },
  { id: "pennsylvania-state-university", name: "Pennsylvania State University" },
  { id: "university-of-maryland", name: "University of Maryland" },
  { id: "virginia-tech", name: "Virginia Tech" },
  { id: "university-of-virginia", name: "University of Virginia" },
  { id: "north-carolina-state-university", name: "North Carolina State University" },
  { id: "university-of-north-carolina-chapel-hill", name: "University of North Carolina at Chapel Hill" },
  { id: "rutgers-university", name: "Rutgers University" },
  { id: "boston-university", name: "Boston University" },
  { id: "northeastern-university", name: "Northeastern University" },
  { id: "new-york-university", name: "New York University" },
  { id: "university-of-southern-california", name: "University of Southern California" },
  { id: "arizona-state-university", name: "Arizona State University" },
  { id: "university-of-arizona", name: "University of Arizona" },
  { id: "university-of-colorado-boulder", name: "University of Colorado Boulder" },
  { id: "university-of-pittsburgh", name: "University of Pittsburgh" },
  { id: "case-western-reserve-university", name: "Case Western Reserve University" },
  { id: "university-of-notre-dame", name: "University of Notre Dame" },
  { id: "vanderbilt-university", name: "Vanderbilt University" },
  { id: "emory-university", name: "Emory University" },
  { id: "rice-university", name: "Rice University" },
  { id: "washington-university-in-st-louis", name: "Washington University in St. Louis" },
  { id: "university-of-rochester", name: "University of Rochester" },
  { id: "rensselaer-polytechnic-institute", name: "Rensselaer Polytechnic Institute" },
  { id: "stevens-institute-of-technology", name: "Stevens Institute of Technology" },
  { id: "worcester-polytechnic-institute", name: "Worcester Polytechnic Institute" },
  { id: "drexel-university", name: "Drexel University" },
  { id: "temple-university", name: "Temple University" },
  { id: "george-mason-university", name: "George Mason University" },
  { id: "university-of-georgia", name: "University of Georgia" },
  { id: "clemson-university", name: "Clemson University" },
  { id: "university-of-alabama", name: "University of Alabama" },
  { id: "auburn-university", name: "Auburn University" },
  { id: "louisiana-state-university", name: "Louisiana State University" },
  { id: "university-of-kentucky", name: "University of Kentucky" },
  { id: "university-of-tennessee", name: "University of Tennessee" },
  { id: "indiana-university", name: "Indiana University" },
  { id: "michigan-state-university", name: "Michigan State University" },
  { id: "iowa-state-university", name: "Iowa State University" },
  { id: "university-of-iowa", name: "University of Iowa" },
  { id: "university-of-kansas", name: "University of Kansas" },
  { id: "university-of-missouri", name: "University of Missouri" },
  { id: "university-of-nebraska", name: "University of Nebraska" },
  { id: "university-of-oklahoma", name: "University of Oklahoma" },
  { id: "oklahoma-state-university", name: "Oklahoma State University" },
  { id: "university-of-utah", name: "University of Utah" },
  { id: "brigham-young-university", name: "Brigham Young University" },
  { id: "university-of-oregon", name: "University of Oregon" },
  { id: "oregon-state-university", name: "Oregon State University" },
  { id: "university-of-nevada-las-vegas", name: "University of Nevada, Las Vegas" },
  { id: "university-of-new-mexico", name: "University of New Mexico" },
  { id: "university-of-hawaii", name: "University of Hawaii" },

  // HBCUs
  { id: "howard-university", name: "Howard University" },
  { id: "morehouse-college", name: "Morehouse College" },
  { id: "spelman-college", name: "Spelman College" },
  { id: "hampton-university", name: "Hampton University" },
  { id: "north-carolina-at-state-university", name: "North Carolina A&T State University" },
  { id: "prairie-view-am-university", name: "Prairie View A&M University" },
  { id: "morgan-state-university", name: "Morgan State University" },

  // Community Colleges (sample)
  { id: "community-college", name: "Community College (Other)" },

  // International Universities (sample)
  { id: "university-of-waterloo", name: "University of Waterloo" },
  { id: "university-of-toronto", name: "University of Toronto" },
  { id: "mcgill-university", name: "McGill University" },
  { id: "university-of-british-columbia", name: "University of British Columbia" },
  { id: "university-of-oxford", name: "University of Oxford" },
  { id: "university-of-cambridge", name: "University of Cambridge" },
  { id: "imperial-college-london", name: "Imperial College London" },
  { id: "eth-zurich", name: "ETH Zurich" },
  { id: "national-university-of-singapore", name: "National University of Singapore" },
  { id: "nanyang-technological-university", name: "Nanyang Technological University" },
  { id: "indian-institute-of-technology", name: "Indian Institute of Technology (IIT)" },
  { id: "tsinghua-university", name: "Tsinghua University" },
  { id: "peking-university", name: "Peking University" },
  { id: "university-of-tokyo", name: "University of Tokyo" },
  { id: "seoul-national-university", name: "Seoul National University" },
  { id: "kaist", name: "KAIST" },

  // Catch-all options
  { id: "high-school", name: "High School" },
  { id: "bootcamp-code-school", name: "Bootcamp / Code School" },
  { id: "other", name: "Other" },
];

// Search function for autocomplete
export function searchSchools(query: string, limit = 10): School[] {
  if (!query || query.length < 2) return [];

  const lowerQuery = query.toLowerCase();

  return mlhSchools
    .filter(school => school.name.toLowerCase().includes(lowerQuery))
    .slice(0, limit);
}
