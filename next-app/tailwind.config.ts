import type { Config } from 'tailwindcss';

// All values reference CSS custom properties defined in globals.css.
// This means Tailwind utilities automatically respond to light/dark
// theme switching via [data-theme="dark"] without any JS branching.

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // -----------------------------------------------------------------------
      // Colors — map every design token to a Tailwind utility
      // -----------------------------------------------------------------------
      colors: {
        bg:       'var(--bg)',
        card:     'var(--card)',
        sep:      'var(--sep)',
        'icon-bg':'var(--icon-bg)',
        accent:   'var(--accent)',
        green:    'var(--green)',
        amber:    'var(--amber)',
        red:      'var(--red)',
        text: {
          DEFAULT: 'var(--text)',
          2:       'var(--text2)',
          3:       'var(--text3)',
        },
        slider: {
          track: 'var(--slider-track)',
        },
        switch: {
          off: 'var(--switch-off)',
        },
        seg: {
          bg:     'var(--seg-bg)',
          active: 'var(--seg-active)',
        },
        // Section / feature tints
        tint: {
          home:       'var(--tint-home)',
          lights:     'var(--tint-lights)',
          doors:      'var(--tint-doors)',
          climate:    'var(--tint-climate)',
          pool:       'var(--tint-pool)',
          music:      'var(--tint-music)',
          fans:       'var(--tint-fans)',
          outdoors:   'var(--tint-outdoors)',
          irrigation: 'var(--tint-irrigation)',
          leak:       'var(--tint-leak)',
          motion:     'var(--tint-motion)',
          settings:   'var(--tint-settings)',
          docs:       'var(--tint-docs)',
          scenes:     'var(--tint-scenes)',
        },
      },

      // -----------------------------------------------------------------------
      // Border radius
      // -----------------------------------------------------------------------
      borderRadius: {
        hca: 'var(--radius)',   // default 22px, user-tunable
        sm:  '9px',
        md:  '14px',
        lg:  '18px',
      },

      // -----------------------------------------------------------------------
      // Spacing — expose tokens as named spacing values
      // -----------------------------------------------------------------------
      spacing: {
        'screen-px': 'var(--screen-px)',   // 18px horizontal screen padding
        'grid-gap':  'var(--grid-gap)',    // 12px tile/card gap
        'card-pad':  'var(--card-pad)',    // 13/16/20 density
        'section':   'var(--section-gap)', // 22px between page sections
      },

      // -----------------------------------------------------------------------
      // Box shadows
      // -----------------------------------------------------------------------
      boxShadow: {
        card:  'var(--shadow)',
        sheet: '0 -8px 40px rgba(0,0,0,.3)',
      },

      // -----------------------------------------------------------------------
      // Font family
      // -----------------------------------------------------------------------
      fontFamily: {
        hca: 'var(--font)',
      },

      // -----------------------------------------------------------------------
      // Transitions — easing + duration tokens
      // -----------------------------------------------------------------------
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.3, 1.4, 0.5, 1)',
      },
      transitionDuration: {
        switch: '220ms',
        slider: '80ms',
        tile:   '200ms',
        sheet:  '280ms',
      },

      // -----------------------------------------------------------------------
      // Min dimensions — tap targets
      // -----------------------------------------------------------------------
      minHeight: {
        tap: '44px',
      },
      minWidth: {
        tap: '44px',
      },
    },
  },
  plugins: [],
};

export default config;
