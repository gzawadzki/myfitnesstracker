import React from 'react';
import { supabase } from '../lib/supabase';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

export default function Login() {
  return (
    <div className="flex items-center justify-center min-h-screen p-6" style={{ background: 'var(--bg-color)' }}>
      <div className="card glass w-full max-w-sm p-6">
        <div className="text-center mb-6">
          <h1 className="h1 mb-2 text-gradient">FitNotes</h1>
          <p className="text-secondary text-sm">Sign in to sync your workouts.</p>
        </div>
        
        <Auth 
          supabaseClient={supabase} 
          appearance={{ 
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: 'var(--accent-primary)',
                  brandAccent: 'var(--accent-hover)',
                  inputText: 'var(--text-primary)',
                  inputBackground: 'var(--surface-color)',
                  inputBorder: 'var(--surface-border)',
                  defaultButtonBackground: 'var(--surface-color)',
                  defaultButtonBackgroundHover: 'var(--surface-hover)',
                  messageText: 'var(--text-primary)',
                  anchorText: 'var(--accent-primary)',
                  dividerBackground: 'var(--surface-border)'
                }
              }
            },
            className: {
              container: 'auth-container',
              button: 'btn',
              input: 'auth-input'
            }
          }}
          providers={[]}
        />
      </div>
    </div>
  );
}
