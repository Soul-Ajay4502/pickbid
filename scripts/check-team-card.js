// Run in the browser console on a league's Teams screen as an organizer.
(async () => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const waitFor = async (check) => {
    for (let i = 0; i < 100; i++) {
      if (check()) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Team card check timed out');
  };
  const name = document.querySelector('button[title="View full squad details"]');
  const card = name?.closest('.card-premium');
  const edit = card?.querySelector('button[title^="Edit team name"], button[title^="Rename team"]');
  assert(name && card && edit, 'Open Teams as an organizer with at least one team');
  const start = location.pathname;
  edit.click();
  await waitFor(() => card.querySelector('button[title="Cancel"]'));
  assert(location.pathname === start, 'Edit must not open the team details');
  card.querySelector('button[title="Cancel"]').click();
  await waitFor(() => card.querySelector('button[title="View full squad details"]'));
  card.querySelector('.space-y-1\\.5').click();
  await waitFor(() => location.pathname.startsWith(`${start}/`));
  console.log('Team card navigation check passed');
})();
