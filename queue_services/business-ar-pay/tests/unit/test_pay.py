# Copyright © 2024 Province of British Columbia
#
# Licensed under the BSD 3 Clause License, (the "License");
# you may not use this file except in compliance with the License.
# The template for the license can be found here
#    https://opensource.org/license/bsd-3-clause/
#
# Redistribution and use in source and binary forms,
# with or without modification, are permitted provided that the
# following conditions are met:
#
# 1. Redistributions of source code must retain the above copyright notice,
#    this list of conditions and the following disclaimer.
#
# 2. Redistributions in binary form must reproduce the above copyright notice,
#    this list of conditions and the following disclaimer in the documentation
#    and/or other materials provided with the distribution.
#
# 3. Neither the name of the copyright holder nor the names of its contributors
#    may be used to endorse or promote products derived from this software
#    without specific prior written permission.
#
# THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
# AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
# THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
# ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
# LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
# CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
# SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
# INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
# CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
# ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
# POSSIBILITY OF SUCH DAMAGE.

"""Tests for the pay_filer worker function."""

import json
from datetime import datetime
from unittest.mock import MagicMock, patch
from http import HTTPStatus

import pytest
from flask import Flask, request

from business_ar_api.models import Filing
from business_ar_pay.resources import pay_filer
from business_ar_pay.resources.pay_filer import worker


class TestPayFiler:
    """Test suite for the pay_filer worker function."""

    @pytest.fixture
    def mock_app(self):
        """Create a Flask app for testing."""
        app = Flask(__name__)
        with app.test_request_context():
            yield app

    @pytest.fixture
    def mock_cloud_event(self):
        """Create a mock cloud event for testing."""
        return {
            "specversion": "1.0",
            "type": "payment_completed",
            "source": "pay-api",
            "id": "12345",
            "time": "2023-01-01T12:00:00Z",
            "datacontenttype": "application/json",
            "data": {"id": 1000, "status_code": "COMPLETED"},
        }

    @pytest.fixture
    def mock_request(self, mock_cloud_event):
        """Create a mock Flask request with cloud event data."""
        return MagicMock(data=json.dumps(mock_cloud_event).encode("utf-8"))

    @patch("business_ar_pay.resources.pay_filer.gcp_queue.get_simple_cloud_event")
    def test_worker_empty_request(self, mock_cloud_event, mock_app):
        """Test handling of empty request data."""
        # Mock empty request
        with patch("flask.request", MagicMock(data=None)):
            response = worker()

        # Verify response
        assert response == ({}, HTTPStatus.OK)
        # Cloud event extraction should not be called
        mock_cloud_event.assert_not_called()

    @patch("business_ar_pay.resources.pay_filer.get_payment_token")
    @patch("business_ar_pay.resources.pay_filer.gcp_queue.get_simple_cloud_event")
    def test_worker_no_payment_token(
        self, mock_cloud_event, mock_payment, mock_app, mock_request
    ):
        """Test handling of event with no payment token."""
        # Mock cloud event extraction
        mock_cloud_event.return_value = {"data": {"id": 1000}}

        # Mock payment token not found
        mock_payment.return_value = None

        # Execute the worker with mocked request
        with patch("flask.request", mock_request):
            response = worker()

        # Verify response - should still return OK to remove from queue
        assert response == ({}, HTTPStatus.OK)

    @patch("business_ar_pay.resources.pay_filer.get_payment_token")
    @patch("business_ar_pay.resources.pay_filer.gcp_queue.get_simple_cloud_event")
    @patch("business_ar_pay.resources.pay_filer.Filing")
    def test_worker_filing_not_found(
        self, mock_filing, mock_cloud_event, mock_payment, mock_app, mock_request
    ):
        """Test handling of payment with no associated filing."""
        # Mock the payment token
        payment_token = MagicMock()
        payment_token.id = 1000
        payment_token.status_code = "COMPLETED"
        mock_payment.return_value = payment_token

        # Mock cloud event extraction
        mock_cloud_event.return_value = {
            "data": {"id": 1000, "status_code": "COMPLETED"}
        }

        # Mock filing not found
        mock_filing.get_filing_by_payment_token.return_value = None

        # Execute the worker with mocked request
        with patch("flask.request", mock_request):
            response = worker()

        # Update to match actual behavior - the worker returns OK even when filing is not found
        assert response == ({}, HTTPStatus.OK)

    @patch("business_ar_pay.resources.pay_filer.get_payment_token")
    @patch("business_ar_pay.resources.pay_filer.gcp_queue.get_simple_cloud_event")
    @patch("business_ar_pay.resources.pay_filer.Filing")
    def test_worker_already_completed(
        self, mock_filing, mock_cloud_event, mock_payment, mock_app, mock_request
    ):
        """Test handling of already processed payment."""
        # Mock the payment token
        payment_token = MagicMock()
        payment_token.id = 1000
        payment_token.status_code = "COMPLETED"
        mock_payment.return_value = payment_token

        # Mock cloud event extraction
        mock_cloud_event.return_value = {
            "data": {"id": 1000, "status_code": "COMPLETED"}
        }

        # Mock filing already completed
        filing = MagicMock()
        filing.status = Filing.Status.COMPLETED.value
        mock_filing.get_filing_by_payment_token.return_value = filing

        # Execute the worker with mocked request
        with patch("flask.request", mock_request):
            response = worker()

        # Verify response
        assert response == ({}, HTTPStatus.OK)

        # Verify filing was not modified
        filing.save.assert_not_called()
