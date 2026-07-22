import { describe, it } from 'vitest';
import { artistNameSimilarity } from '../domain/artist/dedup';

const pairs: [string,string][] = [
  ['T M Krishna','T M Krishnan'],
  ['Thodur Madabusi Krishna','Thodur Madabusi Krishnan'],
  ['Sanjay Subrahmanyan','Sanjay Subrahmanyam'],
  ['N Ravikiran','S Ravikiran'],
  ['Ranjani Gopalakrishnan','Gayatri Gopalakrishnan'],
  ['A Kanyakumari','A Kanyakumar'],
  ['Aruna Sairam','Aruna Sairaman'],
  ['R Vedavalli','R Vedavalli Ammal'],
  ['Sudha Raghunathan','Sudha Ragunathan'],
  ['Neyveli Santhanagopalan','Neyveli Santhanagopal'],
  ['Krishna','Krishnan'],
  ['Umayalpuram K Sivaraman','Umayalpuram K Sivakumar'],
  ['T N Seshagopalan','T V Seshagopalan'],
];
describe('probe', () => {
  it('scores', () => {
    for (const [a,b] of pairs) {
      const s = artistNameSimilarity(a,b);
      console.log(`${s.toFixed(4)}  ${s>=0.85?'MATCH ':'reject'}  ${a}  |  ${b}`);
    }
  });
});
