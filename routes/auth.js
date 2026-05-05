import { Router } from 'express';
import crypto from 'node:crypto';
import { authorizeUrl, exchangeCode, generatePkcePair } from '../lib/salesforce.js';

const router = Router();

router.get('/salesforce/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const { codeVerifier, codeChallenge } = generatePkcePair();
  req.session.oauthState = state;
  req.session.pkceVerifier = codeVerifier;
  res.redirect(authorizeUrl(state, codeChallenge));
});

router.get('/salesforce/callback', async (req, res) => {
  const { code, state, error, error_description: desc } = req.query;
  if (error) return res.status(400).render('error', { title: 'Sign-in declined', message: desc || error });
  if (!code || !state || state !== req.session.oauthState) {
    return res.status(400).render('error', {
      title: 'Sign-in could not be verified',
      message: 'The introduction handshake did not match. Please try again.',
    });
  }
  const codeVerifier = req.session.pkceVerifier;
  delete req.session.oauthState;
  delete req.session.pkceVerifier;

  try {
    const sf = await exchangeCode(code, codeVerifier);
    req.session.sf = sf;
    res.redirect('/app');
  } catch (err) {
    console.error('Salesforce auth error:', err);
    res.status(500).render('error', {
      title: 'Could not complete sign-in',
      message: err.message || 'An unexpected error occurred while contacting Salesforce.',
    });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

export default router;
