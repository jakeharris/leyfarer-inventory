import { describe, expect, it } from 'vitest';
import {
  mergeEntries,
  normalizeQuestName,
  parseBookOnlineEntriesFromHtml,
  parseBookingPageDescriptionFromHtml,
  parseFaqEntriesFromHtml,
  parseServicePageEntriesFromHtml
} from '../../scripts/scrape-side-quests-lib.mjs';

describe('normalizeQuestName', () => {
  it('strips level and availability markers', () => {
    expect(normalizeQuestName('A Troad Less Traveled (Level 3)')).toBe('A Troad Less Traveled');
    expect(normalizeQuestName('All That Glitters (Level 3-14, Scaling) - Available 3/4')).toBe(
      'All That Glitters'
    );
  });

  it('strips leyfarer prefix and bullet marker', () => {
    expect(normalizeQuestName('Leyfarer Quest: The Bridge of Dreams')).toBe('The Bridge of Dreams');
    expect(normalizeQuestName('- Sirens of the Jungle')).toBe('Sirens of the Jungle');
  });
});

describe('FAQ parser contract', () => {
  it('extracts quest names from strong text inside ul.EG7tb li and removes level text', () => {
    const html = `
      <ul class="EG7tb">
        <li class="bthxI"><p><strong><span>A Troad Less Traveled (Level 3)</span></strong></p></li>
        <li class="bthxI"><p><strong><span>All That Glitters (Level 3-14, Scaling) - Available 3/4</span></strong></p></li>
      </ul>
    `;

    const entries = parseFaqEntriesFromHtml(html);
    expect(entries).toEqual([
      { name: 'A Troad Less Traveled' },
      { name: 'All That Glitters' }
    ]);
  });
});

describe('Service page parser contract', () => {
  it('extracts side quests and backstory ReQuests from p[data-hook="description"]', () => {
    const html = `
      <p data-hook="description">
        Leyfarer Side Quests (check our "The Leyfarer's Chronicle" FAQ for details):\n
        - Sirens of the Jungle\n
        - Dead Man's Quest (3/18)\n
        Val'Ruvina Backstory:\n
        - Secrets of the Golden City: The heroes' goal is simple: infiltrate the fey city of Dayspring. (Level 11)\n
        - The Blooms That Feed on Fire: Last stand at the citadel. (Level 16)
      </p>
    `;

    const entries = parseServicePageEntriesFromHtml(html);
    expect(entries).toEqual([
      { name: 'Sirens of the Jungle' },
      { name: "Dead Man's Quest" },
      {
        name: 'Secrets of the Golden City',
        description: "The heroes' goal is simple: infiltrate the fey city of Dayspring."
      },
      {
        name: 'The Blooms That Feed on Fire',
        description: 'Last stand at the citadel.'
      }
    ]);
  });
});

describe('Book-online parser contract', () => {
  it('only accepts Leyfarer Quest cards and captures booking url from Read More', () => {
    const html = `
      <section data-hook="service-card-default-card">
        <h2 data-hook="service-info-title-text">TPK Remix: Golden Vault</h2>
        <a data-hook="more-info-button-root" href="https://www.tpkbrewing.com/service-page/tpk-remix-golden-vault">Read More</a>
      </section>
      <section data-hook="service-card-default-card">
        <h2 data-hook="service-info-title-text">Leyfarer Quest: The Bridge of Dreams</h2>
        <a data-hook="more-info-button-root" href="https://www.tpkbrewing.com/service-page/leyfarer-quest-the-bridge-of-dreams">Read More</a>
      </section>
    `;

    const entries = parseBookOnlineEntriesFromHtml(html);
    expect(entries).toEqual([
      {
        name: 'The Bridge of Dreams',
        'booking-url': 'https://www.tpkbrewing.com/service-page/leyfarer-quest-the-bridge-of-dreams'
      }
    ]);
  });
});

describe('Booking page description contract', () => {
  it('extracts description from p[data-hook="description"] exactly as content source', () => {
    const html = `
      <p data-hook="description">
        The Leyfarers must return to the Dreamwild to help Shayde connect The Green Fort to New Briar's End using the help of a long forgotten song of the fey.

        CR 3 Adventure for The Leyfarer's Chronicle.

        Content Warnings: Violence
      </p>
    `;

    const description = parseBookingPageDescriptionFromHtml(html);
    expect(description).toContain('The Leyfarers must return to the Dreamwild');
    expect(description).toContain("CR 3 Adventure for The Leyfarer's Chronicle.");
    expect(description).toContain('Content Warnings: Violence');
  });
});

describe('Merge precedence', () => {
  it('prefers booking-page description over service-page ReQuest description', () => {
    const merged = mergeEntries(
      [
        {
          name: 'Secrets of the Golden City',
          description: 'Service description.'
        }
      ],
      [
        {
          name: 'Secrets of the Golden City',
          description: 'Booking page description.',
          'booking-url': 'https://www.tpkbrewing.com/service-page/leyfarer-quest-secrets-of-the-golden-city'
        }
      ]
    );

    expect(merged).toEqual([
      {
        name: 'Secrets of the Golden City',
        description: 'Booking page description.',
        'booking-url': 'https://www.tpkbrewing.com/service-page/leyfarer-quest-secrets-of-the-golden-city'
      }
    ]);
  });
});
