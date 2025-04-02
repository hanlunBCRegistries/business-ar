import unittest
from unittest.mock import patch, Mock, MagicMock
from process_paid_filings.job import clean_none, send_email, delete_ar_prompt, complete_filing, TIMEOUT

class TestJob(unittest.TestCase):
    def test_clean_none(self):
        # Input dictionary with None values
        input_dict = {
            'key1': 'value1',
            'key2': None,
            'key3': {
                'subkey1': None,
                'subkey2': 'value2'
            }
        }

        # Expected output where None values are replaced with empty strings
        expected_dict = {
            'key1': 'value1',
            'key2': '',
            'key3': {
                'subkey1': '',
                'subkey2': 'value2'
            }
        }

        # Call the clean_none function
        clean_none(input_dict)

        # Assert that the input dict has been modified as expected
        self.assertEqual(input_dict, expected_dict)
    
    @patch('process_paid_filings.job.requests.post')
    def test_send_email_failure(self, mock_post):
        # Setup mock response for failure
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.text = "Internal server error"
        mock_post.return_value = mock_response
        
        # Mock Flask app
        mock_app = MagicMock()
        mock_app.config = {"BUSINESS_AR_API_URL": "http://test-api"}
        mock_app.logger = MagicMock()
        
        # Call function
        send_email(mock_app, "12345", "test-token")
        
        # Verify error was logged
        mock_app.logger.error.assert_called_once()
    
    @patch('process_paid_filings.job.requests.delete')
    def test_delete_ar_prompt_failure(self, mock_delete):
        # Setup mock response for failure
        mock_response = Mock()
        mock_response.status_code = 404
        mock_response.text = "Not Found"
        mock_delete.return_value = mock_response
        
        # Mock Flask app
        mock_app = MagicMock()
        mock_app.config = {"COLIN_API_URL": "http://colin-api"}
        mock_app.logger = MagicMock()
        
        # Call function
        delete_ar_prompt(mock_app, "BC", "123456", "test-token")
        
        # Verify error was logged
        mock_app.logger.error.assert_called_once()
    
    @patch('process_paid_filings.job.requests.patch')
    def test_complete_filing_success(self, mock_patch):
        # Setup mock response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_patch.return_value = mock_response
        
        # Mock Flask app
        mock_app = MagicMock()
        mock_app.config = {"BUSINESS_AR_API_URL": "http://test-api"}
        mock_app.logger = MagicMock()
        
        # Call function
        complete_filing(mock_app, "12345", [101, 102], "test-token")
        
        # Verify requests.patch was called with correct parameters
        mock_patch.assert_called_once()
        call_args = mock_patch.call_args
        self.assertEqual(call_args[1]['url'], "http://test-api/internal/filings/12345")
        self.assertIn('"colinEventIds": [101, 102]', call_args[1]['data'])
        
        # Verify no errors were logged
        mock_app.logger.error.assert_not_called()
    
    @patch('process_paid_filings.job.requests.patch')
    def test_complete_filing_failure(self, mock_patch):
        # Setup mock response for failure
        mock_response = Mock()
        mock_response.status_code = 500
        mock_patch.return_value = mock_response
        
        # Mock Flask app
        mock_app = MagicMock()
        mock_app.config = {"BUSINESS_AR_API_URL": "http://test-api"}
        mock_app.logger = MagicMock()
        
        # Call function
        complete_filing(mock_app, "12345", [101, 102], "test-token")
        
        # Verify error was logged
        mock_app.logger.error.assert_called_once()

if __name__ == '__main__':
    unittest.main()
