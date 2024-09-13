import React from "react";
import { graphql } from "gatsby";

import styled from "styled-components";

import Layout from "components/Layout";
import SEO from "components/SEO";
import PostList from "components/PostList";
import Divider from "components/Divider";

import { description, siteUrl } from "../../blog-config";

const Header = styled.div`
  @media (max-width: 768px) {
    padding: 0px 15px;
  }
`;

const Title = styled.h1`
  margin-bottom: 15px;
  line-height: 1.2;
  font-size: 44.8px;
  font-weight: bold;
  color: ${(props) => props.theme.colors.text};
  word-break: break-all;
`;

const Subtitle = styled.h3`
  display: inline-block;
  padding: 2px 3px;
  margin-top: 32px;
  margin-bottom: 8px;
  font-size: 20px;
  font-weight: bold;
  background-color: ${(props) => props.theme.colors.text};
  color: ${(props) => props.theme.colors.bodyBackground};
  letter-spacing: -1px;
`;

const SeriesInform = styled.div`
  display: flex;
  align-items: center;
  font-size: 16px;
  color: ${(props) => props.theme.colors.text};

  & > span {
    margin: 0 3px;
  }
`;

const Date = styled.span`
  color: ${(props) => props.theme.colors.tertiaryText};
  font-weight: lighter;
`;

const Series = ({ pageContext, data }) => {
  const seriesName = pageContext.series;

  // "hiyen" 태그를 가진 포스트를 먼저 가져옴
  const hiyenPosts = data.hiyenPosts.nodes;
  // 나머지 포스트들을 최신순으로 가져옴
  const otherPosts = data.otherPosts.nodes;

  // 두 리스트를 결합하여 최종 포스트 리스트 생성
  const sortedPosts = [...hiyenPosts, ...otherPosts];

  return (
    <Layout>
      <SEO
        title={`SERIES: ${seriesName}`}
        description={description}
        url={siteUrl}
      />

      <Header>
        <Subtitle> SERIES </Subtitle>
        <Title> {seriesName} </Title>

        <SeriesInform>
          <span>{sortedPosts.length} Posts</span>
          <span>·</span>
          <Date>
            Last updated on {sortedPosts[sortedPosts.length - 1].frontmatter.date}
          </Date>
        </SeriesInform>

        <Divider />
      </Header>

      <PostList postList={sortedPosts} />
    </Layout>
  );
};

export default Series;

export const pageQuery = graphql`
  query BlogSeriesBySeriesName($series: String) {
    hiyenPosts: allMarkdownRemark(
      sort: { order: DESC, fields: [frontmatter___date] }
      filter: { frontmatter: { series: { eq: $series }, tags: { in: ["hiyen"] } } }
    ) {
      nodes {
        excerpt(pruneLength: 200, truncate: true)
        fields {
          slug
        }
        frontmatter {
          date(formatString: "MMMM DD, YYYY")
          update(formatString: "MMM DD, YYYY")
          title
          tags
        }
      }
    }
    otherPosts: allMarkdownRemark(
      sort: { order: DESC, fields: [frontmatter___date] }
      filter: { frontmatter: { series: { eq: $series }, tags: { nin: ["hiyen"] } } }
    ) {
      nodes {
        excerpt(pruneLength: 200, truncate: true)
        fields {
          slug
        }
        frontmatter {
          date(formatString: "MMMM DD, YYYY")
          update(formatString: "MMM DD, YYYY")
          title
          tags
        }
      }
    }
  }
`;