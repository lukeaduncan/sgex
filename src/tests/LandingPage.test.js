import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LandingPage from '../components/LandingPage';

// Mock the GitHub service
jest.mock('../services/githubService', () => ({
  __esModule: true,
  default: {
    isAuth: jest.fn(() => false),
    authenticate: jest.fn(() => true),
    authenticateWithOctokit: jest.fn(),
    logout: jest.fn(),
    getCurrentUser: jest.fn(() => Promise.resolve({ login: 'testuser', name: 'Test User', avatar_url: 'https://example.com/avatar.png' })),
    getUserOrganizations: jest.fn(() => Promise.resolve([])),
    checkTokenPermissions: jest.fn(() => Promise.resolve())
  }
}));

// Mock PAT login component
jest.mock('../components/PATLogin', () => {
  return function MockPATLogin() {
    return <div data-testid="pat-login">Mock PAT Login</div>;
  };
});

describe('LandingPage', () => {
  test('renders landing page without authentication', () => {
    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );
    
    expect(screen.getByText('SGEX Workbench')).toBeInTheDocument();
    expect(screen.getByText('WHO SMART Guidelines Exchange')).toBeInTheDocument();
    expect(screen.getByTestId('pat-login')).toBeInTheDocument();
  });
});