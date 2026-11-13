import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EventList } from './event-list';

const events = [
  {
    id: 'e1',
    title: 'Vocal Concert',
    startDateTime: '2030-11-16T12:30:00.000Z',
    timezone: 'Asia/Kolkata',
    venueName: 'Narada Gana Sabha',
    city: 'Chennai',
    artists: [{ name: 'A B', role: 'vocal' }],
    posterUrl: 'https://cdn.example/p.jpg',
    entryType: 'free',
  },
];

describe('EventList', () => {
  it('links to /events/<id> with a plain anchor by default', () => {
    const html = renderToStaticMarkup(<EventList events={events} />);
    expect(html).toContain('<a href="/events/e1"');
    expect(html).toContain('Vocal Concert');
    expect(html).toContain('Narada Gana Sabha, Chennai');
    expect(html).toContain('A B (vocal)');
    expect(html).toContain('Free');
    expect(html).toContain('<img src="https://cdn.example/p.jpg"');
  });

  it('uses an injected link, so each app keeps its own router', () => {
    const html = renderToStaticMarkup(
      <EventList
        events={events}
        renderLink={({ event, className, children }) => (
          <a data-router-link href={`https://rasika.life/events/${event.id}`} className={className}>
            {children}
          </a>
        )}
      />
    );
    expect(html).toContain('data-router-link');
    expect(html).toContain('href="https://rasika.life/events/e1"');
  });

  it('hides the venue and the city where asked, and prints the time in the event zone', () => {
    const html = renderToStaticMarkup(<EventList events={events} showVenue={false} />);
    expect(html).not.toContain('Narada');
    expect(html).toContain('6:00 pm');
    const noCity = renderToStaticMarkup(<EventList events={events} showCity={false} />);
    expect(noCity).toContain('Narada Gana Sabha<');
  });

  it('renders content under a row, outside its link', () => {
    const html = renderToStaticMarkup(
      <EventList events={events} renderAfter={event => <em>after {event.id}</em>} />
    );
    expect(html).toMatch(/<\/a><em>after e1<\/em><\/li>/);
  });
});
