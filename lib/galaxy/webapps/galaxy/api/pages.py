"""
API for updating Galaxy Pages
"""
import logging

from galaxy.managers.base import get_object
from galaxy.managers.pages import (
    PageManager,
    PageSerializer
)
from galaxy.model.item_attrs import UsesAnnotations
from galaxy.web import expose_api
from galaxy.webapps.base.controller import (
    BaseAPIController,
    SharableItemSecurityMixin,
    SharableMixin
)

log = logging.getLogger(__name__)


class PagesController(BaseAPIController, SharableItemSecurityMixin, UsesAnnotations, SharableMixin):
    """
    RESTful controller for interactions with pages.
    """

    def __init__(self, app):
        super(PagesController, self).__init__(app)
        self.manager = PageManager(app)
        self.serializer = PageSerializer(app)

    @expose_api
    def index(self, trans, deleted=False, **kwd):
        """
        index( self, trans, deleted=False, **kwd )
        * GET /api/pages
            return a list of Pages viewable by the user

        :param deleted: Display deleted pages

        :rtype:     list
        :returns:   dictionaries containing summary or detailed Page information
        """
        out = []

        if trans.user_is_admin:
            r = trans.sa_session.query(trans.app.model.Page)
            if not deleted:
                r = r.filter_by(deleted=False)
            for row in r:
                out.append(self.encode_all_ids(trans, row.to_dict(), True))
        else:
            user = trans.get_user()
            r = trans.sa_session.query(trans.app.model.Page).filter_by(user=user)
            if not deleted:
                r = r.filter_by(deleted=False)
            for row in r:
                out.append(self.encode_all_ids(trans, row.to_dict(), True))
            r = trans.sa_session.query(trans.app.model.Page).filter(trans.app.model.Page.user != user).filter_by(published=True)
            if not deleted:
                r = r.filter_by(deleted=False)
            for row in r:
                out.append(self.encode_all_ids(trans, row.to_dict(), True))

        return out

    @expose_api
    def create(self, trans, payload, **kwd):
        """
        create( self, trans, payload, **kwd )
        * POST /api/pages
            Create a page and return dictionary containing Page summary

        :param  payload:    dictionary structure containing::
            'slug'       = The title slug for the page URL, must be unique
            'title'      = Title of the page
            'content'    = HTML contents of the page
            'annotation' = Annotation that will be attached to the page

        :rtype:     dict
        :returns:   Dictionary return of the Page.to_dict call
        """
        page = self.manager.create(trans, payload)
        rval = self.encode_all_ids(trans, page.to_dict(), True)
        rval['content'] = page.latest_revision.content
        self.manager.rewrite_content_for_export(trans, rval)
        return rval

    @expose_api
    def delete(self, trans, id, **kwd):
        """
        delete( self, trans, id, **kwd )
        * DELETE /api/pages/{id}
            Create a page and return dictionary containing Page summary

        :param  id:    ID of page to be deleted

        :rtype:     dict
        :returns:   Dictionary with 'success' or 'error' element to indicate the result of the request
        """
        page = get_object(trans, id, 'Page', check_ownership=True)

        # Mark a page as deleted
        page.deleted = True
        trans.sa_session.flush()
        return ''  # TODO: Figure out what to return on DELETE, document in guidelines!

    @expose_api
    def show(self, trans, id, **kwd):
        """
        show( self, trans, id, **kwd )
        * GET /api/pages/{id}
            View a page summary and the content of the latest revision

        :param  id:    ID of page to be displayed

        :rtype:     dict
        :returns:   Dictionary return of the Page.to_dict call with the 'content' field populated by the most recent revision
        """
        page = get_object(trans, id, 'Page', check_ownership=False, check_accessible=True)
        rval = self.encode_all_ids(trans, page.to_dict(), True)
        rval['content'] = page.latest_revision.content
        self.manager.rewrite_content_for_export(trans, rval)
        return rval
